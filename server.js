const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

/* ===============================
   CORS (FIXED FOR PRODUCTION)
================================ */

const allowedOrigins = [
    "http://localhost:3000",
    "https://127.0.0.1:3000",
    "http://10.81.143.223:5500",
    "https://ikeahomesolution.vercel.app"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Postman / curl

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error("CORS blocked: " + origin));
        }
    },
    credentials: true
}));

// Preflight
// app.options(/.*/, cors());

/* ===============================
   MIDDLEWARE
================================ */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ===============================
   DATABASE
================================ */

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
        console.error('❌ MongoDB error:', err.message);
        process.exit(1);
    });

/* ===============================
   ROUTES
================================ */

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

/* ===============================
   HEALTH CHECK
================================ */

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        time: new Date()
    });
});

/* ===============================
   ERROR HANDLING
================================ */

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// 500
app.use((err, req, res, next) => {
    console.error("❌ Error:", err.message);

    res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

/* ===============================
   START SERVER
================================ */

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 IKEA API running on port ${PORT}`);
});