const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/profile', protect, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.user._id, { name: req.body.name }, { new: true });
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);
        const ok = await user.comparePassword(currentPassword);
        if (!ok) return res.status(401).json({ success: false, message: 'Current password incorrect.' });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Min 6 characters.' });
        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password changed.' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;