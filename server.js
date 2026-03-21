const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const app = express();

// ── CORS — must be FIRST before everything ──
const corsOptions = {
    origin: function (origin, callback) { callback(null, true); },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Handle ALL preflight requests globally
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── MongoDB ──
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅  MongoDB connected'))
    .catch((err) => { console.error('❌  MongoDB error:', err.message); process.exit(1); });

// ── Routes ──
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// ── Health ──
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));

// ── Start ──
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀  IKEA API running on http://0.0.0.0:${PORT}`));