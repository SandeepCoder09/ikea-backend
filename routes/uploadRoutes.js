const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { adminOnly } = require('../middleware/adminMiddleware');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, unique + path.extname(file.originalname));
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('Only image files allowed.'));
    },
});

router.post('/image', adminOnly, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const url = `${process.env.CLIENT_URL || 'http://localhost:5000'}/uploads/${req.file.filename}`;
    res.json({ success: true, url });
});

module.exports = router;