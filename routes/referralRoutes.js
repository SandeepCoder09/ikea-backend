const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/authMiddleware');

router.get('/team', protect, async (req, res) => {
    try {
        const level1 = await User.find({ referredBy: req.user._id })
            .select('uid name mobile totalDeposited createdAt');
        const l1Ids = level1.map(u => u._id);
        const level2 = await User.find({ referredBy: { $in: l1Ids } })
            .select('uid name mobile totalDeposited createdAt');
        const l2Ids = level2.map(u => u._id);
        const level3 = await User.find({ referredBy: { $in: l2Ids } })
            .select('uid name mobile totalDeposited createdAt');

        const L1 = parseFloat(process.env.REFERRAL_COMMISSION_L1 || 3) / 100;
        const L2 = parseFloat(process.env.REFERRAL_COMMISSION_L2 || 1) / 100;
        const L3 = parseFloat(process.env.REFERRAL_COMMISSION_L3 || 1) / 100;

        const fmt = (members, level, pct) => members.map(m => ({
            userId: m.uid, name: m.name, level,
            recharge: m.totalDeposited,
            commission: parseFloat((m.totalDeposited * pct).toFixed(2)),
            joinDate: m.createdAt,
        }));

        const allMembers = [
            ...fmt(level1, 1, L1),
            ...fmt(level2, 2, L2),
            ...fmt(level3, 3, L3),
        ];

        const totalRecharge = allMembers.reduce((s, m) => s + m.recharge, 0);
        const totalCommission = allMembers.reduce((s, m) => s + m.commission, 0);

        const commTxns = await Transaction.find({ user: req.user._id, type: 'commission' });
        const now = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const yestStart = new Date(todayStart); yestStart.setDate(yestStart.getDate() - 1);
        const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);

        res.json({
            success: true,
            summary: { totalMembers: allMembers.length, totalRecharge, totalCommission },
            income: {
                total: commTxns.reduce((s, t) => s + t.amount, 0),
                today: commTxns.filter(t => t.createdAt >= todayStart).reduce((s, t) => s + t.amount, 0),
                yesterday: commTxns.filter(t => t.createdAt >= yestStart && t.createdAt < todayStart).reduce((s, t) => s + t.amount, 0),
                week: commTxns.filter(t => t.createdAt >= weekStart).reduce((s, t) => s + t.amount, 0),
            },
            levelIncome: {
                level1: fmt(level1, 1, L1).reduce((s, m) => s + m.commission, 0),
                level2: fmt(level2, 2, L2).reduce((s, m) => s + m.commission, 0),
                level3: fmt(level3, 3, L3).reduce((s, m) => s + m.commission, 0),
            },
            qualified: level1.length >= 3,
            members: allMembers,
            referralCode: req.user.referralCode,
        });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;