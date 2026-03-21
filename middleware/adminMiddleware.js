const { protect } = require('./authMiddleware');

const adminOnly = async (req, res, next) => {
    await protect(req, res, async () => {
        if (!req.user?.isAdmin) {
            return res.status(403).json({ success: false, message: 'Admin access only.' });
        }
        next();
    });
};

module.exports = { adminOnly };