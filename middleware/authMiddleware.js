const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    try {
        let token = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1] : null;
        if (!token) return res.status(401).json({ success: false, message: 'No token.' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password -withdrawPin');
        if (!user || !user.isActive)
            return res.status(401).json({ success: false, message: 'User not found.' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token invalid.' });
    }
};

module.exports = { protect };