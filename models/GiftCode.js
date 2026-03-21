// models/GiftCode.js
const mongoose = require('mongoose');

const giftCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, default: 'Gift Reward' },
    isActive: { type: Boolean, default: true },
    maxUses: { type: Number, default: 1 },        // 1 = single use
    usedCount: { type: Number, default: 0 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, default: null },        // null = no expiry
}, { timestamps: true });

module.exports = mongoose.model('GiftCode', giftCodeSchema);