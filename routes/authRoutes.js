const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

router.post('/register', async (req, res) => {
    try {
        const { name, mobile, password, referralCode } = req.body;
        if (!name || !mobile || !password)
            return res.status(400).json({ success: false, message: 'Name, mobile and password required.' });
        const exists = await User.findOne({ mobile });
        if (exists) return res.status(400).json({ success: false, message: 'Mobile already registered.' });
        let referredBy = null;
        if (referralCode) {
            const ref = await User.findOne({ referralCode: referralCode.toUpperCase() });
            if (ref) referredBy = ref._id;
        }
        const user = await User.create({ name, mobile, password, referredBy });
        const token = signToken(user._id);
        res.status(201).json({ success: true, token, user });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/login', async (req, res) => {
    try {
        const { mobile, password } = req.body;
        if (!mobile || !password)
            return res.status(400).json({ success: false, message: 'Mobile and password required.' });
        const user = await User.findOne({ mobile });
        if (!user || !(await user.comparePassword(password)))
            return res.status(401).json({ success: false, message: 'Invalid mobile or password.' });
        if (!user.isActive)
            return res.status(403).json({ success: false, message: 'Account suspended.' });
        const token = signToken(user._id);
        res.json({ success: true, token, user });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;