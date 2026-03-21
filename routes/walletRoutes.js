// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GiftCode = require('../models/GiftCode');
const BankAccount = require('../models/BankAccount');
const { protect } = require('../middleware/authMiddleware');
console.log("Protect Middleware:", protect);

const FEE = parseFloat(process.env.WITHDRAWAL_FEE_PERCENT || 10) / 100;

/* ── GET /api/wallet/balance ── */
router.get('/balance', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('walletBalance uid name');
        res.json({ success: true, balance: user.walletBalance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/wallet/transactions ── */
router.get('/transactions', protect, async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        const filter = { user: req.user._id };
        if (type && type !== 'all') filter.type = type;

        const txns = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));
        const total = await Transaction.countDocuments(filter);

        res.json({ success: true, total, page: Number(page), transactions: txns });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/wallet/deposit ── */
router.post('/deposit', protect, async (req, res) => {
    try {
        const { amount, method, utr } = req.body;
        const amt = Number(amount);

        if (!amt || amt < 100) return res.status(400).json({ success: false, message: 'Minimum deposit is ₹100.' });
        if (amt > 50000) return res.status(400).json({ success: false, message: 'Maximum deposit is ₹50,000.' });
        if (!utr) return res.status(400).json({ success: false, message: 'UTR / reference number required.' });

        // Create pending transaction (admin will verify & approve)
        const txn = await Transaction.create({
            user: req.user._id,
            type: 'deposit',
            amount: amt,
            status: 'pending',
            utr,
            note: `Deposit via ${method || 'UPI'}`,
            meta: { method },
        });

        res.status(201).json({ success: true, message: 'Deposit request submitted! Will be credited within 30 minutes after verification.', transaction: txn });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/wallet/withdraw ── */
router.post('/withdraw', protect, async (req, res) => {
    try {
        const { amount, pin } = req.body;
        const amt = Number(amount);

        if (!amt || amt < 100) return res.status(400).json({ success: false, message: 'Minimum withdrawal is ₹100.' });
        if (amt > 50000) return res.status(400).json({ success: false, message: 'Maximum withdrawal is ₹50,000.' });

        const user = await User.findById(req.user._id);
        if (user.walletBalance < amt) return res.status(400).json({ success: false, message: 'Insufficient balance.' });
        if (!user.withdrawPin) return res.status(400).json({ success: false, message: 'Withdrawal PIN not set.' });

        const pinOk = await user.comparePin(pin);
        if (!pinOk) return res.status(401).json({ success: false, message: 'Incorrect PIN.' });

        const bank = await BankAccount.findOne({ user: user._id });
        if (!bank) return res.status(400).json({ success: false, message: 'No bank account linked.' });

        const fee = parseFloat((amt * FEE).toFixed(2));
        const netAmount = parseFloat((amt - fee).toFixed(2));
        const newBalance = parseFloat((user.walletBalance - amt).toFixed(2));

        // Deduct balance immediately
        await User.findByIdAndUpdate(user._id, {
            $inc: { walletBalance: -amt, totalWithdrawn: amt },
        });

        const txn = await Transaction.create({
            user: user._id,
            type: 'withdraw',
            amount: amt,
            fee,
            netAmount,
            status: 'pending',
            balanceAfter: newBalance,
            note: `Withdrawal to ${bank.bankName} XXXX${bank.accNumber.slice(-4)}`,
            meta: { bank: { name: bank.bankName, accLast4: bank.accNumber.slice(-4), ifsc: bank.ifsc } },
        });

        res.status(201).json({
            success: true,
            message: `Withdrawal of ₹${amt} submitted. You will receive ₹${netAmount} after ${FEE * 100}% fee.`,
            transaction: txn,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/wallet/set-pin ── */
router.post('/set-pin', protect, async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            return res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits.' });
        }
        const user = await User.findById(req.user._id);
        user.withdrawPin = pin;   // pre-save hook hashes it
        await user.save();
        res.json({ success: true, message: 'Withdrawal PIN set successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/wallet/has-pin ── */
router.get('/has-pin', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('withdrawPin');
        res.json({ success: true, hasPin: !!user.withdrawPin });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/wallet/redeem-gift ── */
router.post('/redeem-gift', protect, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ success: false, message: 'Gift code required.' });

        const gift = await GiftCode.findOne({ code: code.toUpperCase().trim() });

        if (!gift || !gift.isActive) return res.status(404).json({ success: false, message: 'Invalid or expired gift code.' });
        if (gift.expiresAt && gift.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'This gift code has expired.' });
        if (gift.usedBy.includes(req.user._id)) return res.status(400).json({ success: false, message: 'You have already redeemed this code.' });
        if (gift.usedCount >= gift.maxUses) return res.status(400).json({ success: false, message: 'This gift code has been fully used.' });

        const newBalance = parseFloat((req.user.walletBalance + gift.amount).toFixed(2));

        // Update gift
        gift.usedBy.push(req.user._id);
        gift.usedCount += 1;
        if (gift.usedCount >= gift.maxUses) gift.isActive = false;
        await gift.save();

        // Credit wallet
        await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: gift.amount } });

        // Transaction record
        await Transaction.create({
            user: req.user._id,
            type: 'gift',
            amount: gift.amount,
            status: 'success',
            note: `Gift code redeemed: ${gift.code}`,
            balanceAfter: newBalance,
            meta: { code: gift.code, description: gift.description },
        });

        res.json({ success: true, message: `₹${gift.amount} credited! ${gift.description}`, amount: gift.amount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── POST /api/wallet/bind-bank ── */
router.post('/bind-bank', protect, async (req, res) => {
    try {
        const { holderName, bankName, accNumber, ifsc } = req.body;
        if (!holderName || !bankName || !accNumber || !ifsc) {
            return res.status(400).json({ success: false, message: 'All bank details are required.' });
        }

        const exists = await BankAccount.findOne({ user: req.user._id });
        if (exists) return res.status(400).json({ success: false, message: 'Bank account already linked. Contact support to change.' });

        const bank = await BankAccount.create({
            user: req.user._id,
            holderName, bankName,
            accNumber: accNumber.slice(-4).padStart(accNumber.length, 'X'),  // mask
            ifsc: ifsc.toUpperCase(),
        });

        res.status(201).json({ success: true, message: 'Bank account linked successfully!', bank });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ── GET /api/wallet/bank ── */
router.get('/bank', protect, async (req, res) => {
    try {
        const bank = await BankAccount.findOne({ user: req.user._id });
        res.json({ success: true, bank: bank || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;