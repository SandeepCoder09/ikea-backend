// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const UserPlan = require('../models/UserPlan');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

/* ── GET /api/products  — public, all active products ── */
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        const filter = { isActive: true };
        if (category) filter.category = category;

        const products = await Product.find(filter).sort({ sortOrder: 1, price: 1 });
        res.json({ success: true, count: products.length, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/products/:id ── */
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product || !product.isActive) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }
        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/products/buy — purchase a plan ── */
router.post('/buy', protect, async (req, res) => {
    try {
        const { productId } = req.body;
        const user = req.user;

        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        if (user.walletBalance < product.price) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
        }

        // Deduct balance
        const newBalance = parseFloat((user.walletBalance - product.price).toFixed(2));

        // Create transaction
        const txn = await Transaction.create({
            user: user._id,
            type: 'deposit', // 'deposit' used as plan-purchase debit internally
            amount: product.price,
            status: 'success',
            note: `Plan purchase: ${product.name}`,
            balanceAfter: newBalance,
            meta: { productId: product._id, productName: product.name },
        });

        // Create user plan
        const plan = await UserPlan.create({
            user: user._id,
            product: product._id,
            purchasePrice: product.price,
            daily: product.daily,
            validity: product.validity,
            transaction: txn._id,
        });

        // Update user balance & product buyer count
        await User.findByIdAndUpdate(user._id, {
            $inc: { walletBalance: -product.price, totalDeposited: product.price },
        });
        await Product.findByIdAndUpdate(product._id, { $inc: { totalBuyers: 1 } });

        res.status(201).json({ success: true, message: 'Plan purchased successfully!', plan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/products/my-plans — user's purchased plans ── */
router.get('/my-plans/list', protect, async (req, res) => {
    try {
        const plans = await UserPlan.find({ user: req.user._id })
            .populate('product', 'name icon category')
            .sort({ createdAt: -1 });

        // Auto-expire past-endDate plans
        const now = new Date();
        const updated = plans.map(async (p) => {
            if (p.status === 'active' && new Date(p.endDate) < now) {
                p.status = 'expired';
                await p.save();
            }
            return p;
        });
        await Promise.all(updated);

        res.json({ success: true, count: plans.length, plans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/products/claim/:planId — claim daily earning ── */
router.post('/claim/:planId', protect, async (req, res) => {
    try {
        const plan = await UserPlan.findOne({ _id: req.params.planId, user: req.user._id });
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
        if (plan.status !== 'active') return res.status(400).json({ success: false, message: 'Plan is not active.' });
        if (plan.claimedToday) return res.status(400).json({ success: false, message: 'Already claimed today. Come back tomorrow!' });

        const newBalance = parseFloat((req.user.walletBalance + plan.daily).toFixed(2));

        // Create earning transaction
        await Transaction.create({
            user: req.user._id,
            type: 'earning',
            amount: plan.daily,
            status: 'success',
            note: `Daily earning – ${plan.product || 'Plan'} Day ${plan.daysElapsed}`,
            balanceAfter: newBalance,
        });

        // Update plan
        plan.totalClaimed += plan.daily;
        plan.claimedToday = true;
        plan.lastClaimedAt = new Date();
        if (plan.daysRemaining === 0) plan.status = 'expired';
        await plan.save();

        // Update user wallet
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { walletBalance: plan.daily, totalEarned: plan.daily },
        });

        res.json({ success: true, message: `₹${plan.daily} credited to your wallet!`, credited: plan.daily });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ════════════════════════════════════════════════
//  ADMIN — create / update / delete products
// ════════════════════════════════════════════════

/* ── POST /api/products/admin/create ── */
router.post('/admin/create', adminOnly, async (req, res) => {
    try {
        const { name, description, price, daily, validity, category, icon, isPopular, sortOrder } = req.body;
        const product = await Product.create({ name, description, price, daily, validity, category, icon, isPopular, sortOrder });
        res.status(201).json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── PUT /api/products/admin/:id ── */
router.put('/admin/:id', adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── DELETE /api/products/admin/:id ── */
router.delete('/admin/:id', adminOnly, async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ success: true, message: 'Product deactivated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;