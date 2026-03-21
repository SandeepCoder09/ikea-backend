// models/UserPlan.js
const mongoose = require('mongoose');

const userPlanSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    purchasePrice: { type: Number, required: true },
    daily: { type: Number, required: true },
    validity: { type: Number, required: true },   // days
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    totalReturn: { type: Number },
    totalClaimed: { type: Number, default: 0 },
    lastClaimedAt: { type: Date, default: null },
    claimedToday: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['active', 'expired', 'pending'],
        default: 'active',
    },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
}, { timestamps: true, toJSON: { virtuals: true } });

// ── Set endDate & totalReturn on save ──
userPlanSchema.pre('save', function (next) {
    if (this.isNew) {
        const end = new Date(this.startDate);
        end.setDate(end.getDate() + this.validity);
        this.endDate = end;
        this.totalReturn = this.daily * this.validity;
    }
    next();
});

// ── Virtual: days elapsed ──
userPlanSchema.virtual('daysElapsed').get(function () {
    const diff = Date.now() - new Date(this.startDate).getTime();
    return Math.min(this.validity, Math.floor(diff / (1000 * 60 * 60 * 24)));
});

// ── Virtual: days remaining ──
userPlanSchema.virtual('daysRemaining').get(function () {
    return Math.max(0, this.validity - this.daysElapsed);
});

// ── Virtual: progress % ──
userPlanSchema.virtual('progress').get(function () {
    return Math.round((this.daysElapsed / this.validity) * 100);
});

module.exports = mongoose.model('UserPlan', userPlanSchema);