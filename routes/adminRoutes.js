// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const GiftCode = require('../models/GiftCode');
const UserPlan = require('../models/UserPlan');
const { adminOnly } = require('../middleware/adminMiddleware');

/* ── GET /api/admin/dashboard ── */
router.get('/dashboard', adminOnly, async (req, res) => {
    try {
        const [users, products, txns, plans] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Transaction.countDocuments(),
            UserPlan.countDocuments({ status: 'active' }),
        ]);

        const pendingDeposits = await Transaction.countDocuments({ type: 'deposit', status: 'pending' });
        const pendingWithdraws = await Transaction.countDocuments({ type: 'withdraw', status: 'pending' });

        res.json({ success: true, stats: { users, products, transactions: txns, activePlans: plans, pendingDeposits, pendingWithdraws } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/admin/users ── */
router.get('/users', adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const filter = {};
        if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { mobile: new RegExp(search, 'i') }, { uid: new RegExp(search, 'i') }];

        const users = await User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
        const total = await User.countDocuments(filter);
        res.json({ success: true, total, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── PUT /api/admin/users/:id/toggle ── */
router.put('/users/:id/toggle', adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        user.isActive = !user.isActive;
        await user.save();
        res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'suspended'}.`, isActive: user.isActive });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/admin/transactions ── */
router.get('/transactions', adminOnly, async (req, res) => {
    try {
        const { type, status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (type && type !== 'all') filter.type = type;
        if (status && status !== 'all') filter.status = status;

        const txns = await Transaction.find(filter).populate('user', 'uid name mobile').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
        const total = await Transaction.countDocuments(filter);
        res.json({ success: true, total, transactions: txns });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── PUT /api/admin/transactions/:id/approve ── */
router.put('/transactions/:id/approve', adminOnly, async (req, res) => {
    try {
        const txn = await Transaction.findById(req.params.id).populate('user');
        if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found.' });
        if (txn.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed.' });

        txn.status = 'success';
        const newBal = parseFloat((txn.user.walletBalance + txn.amount).toFixed(2));
        txn.balanceAfter = newBal;
        await txn.save();

        await User.findByIdAndUpdate(txn.user._id, { $inc: { walletBalance: txn.amount } });
        res.json({ success: true, message: 'Transaction approved & balance credited.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── PUT /api/admin/transactions/:id/reject ── */
router.put('/transactions/:id/reject', adminOnly, async (req, res) => {
    try {
        const txn = await Transaction.findById(req.params.id).populate('user');
        if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found.' });
        if (txn.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed.' });

        txn.status = 'failed';
        await txn.save();

        // Refund if withdrawal was rejected
        if (txn.type === 'withdraw') {
            await User.findByIdAndUpdate(txn.user._id, { $inc: { walletBalance: txn.amount, totalWithdrawn: -txn.amount } });
        }

        res.json({ success: true, message: 'Transaction rejected.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/admin/gift-codes ── */
router.post('/gift-codes', adminOnly, async (req, res) => {
    try {
        const { code, amount, description, maxUses, expiresAt } = req.body;
        if (!code || !amount) return res.status(400).json({ success: false, message: 'Code and amount required.' });

        const gift = await GiftCode.create({ code: code.toUpperCase(), amount, description, maxUses: maxUses || 1, expiresAt: expiresAt || null });
        res.status(201).json({ success: true, gift });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/admin/gift-codes ── */
router.get('/gift-codes', adminOnly, async (req, res) => {
    try {
        const gifts = await GiftCode.find().sort({ createdAt: -1 });
        res.json({ success: true, gifts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── DELETE /api/admin/gift-codes/:id ── */
router.delete('/gift-codes/:id', adminOnly, async (req, res) => {
    try {
        await GiftCode.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ success: true, message: 'Gift code deactivated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;