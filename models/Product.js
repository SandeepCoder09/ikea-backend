// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    daily: { type: Number, required: true, min: 0 },  // daily return ₹
    validity: { type: Number, required: true, min: 1 },  // days
    category: {
        type: String,
        enum: ['starter', 'basic', 'plus', 'pro', 'elite', 'premium'],
        required: true,
    },
    icon: { type: String, default: 'fa-box' },       // FontAwesome icon class
    image: { type: String, default: null },            // URL from upload
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    totalBuyers: { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true } });

// ── Virtual: total return ──
productSchema.virtual('totalReturn').get(function () {
    return this.daily * this.validity;
});

// ── Virtual: ROI % ──
productSchema.virtual('roi').get(function () {
    return parseFloat(((this.totalReturn - this.price) / this.price * 100).toFixed(1));
});

module.exports = mongoose.model('Product', productSchema);