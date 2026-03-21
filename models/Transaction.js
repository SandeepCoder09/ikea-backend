// models/Transaction.js
const mongoose = require('mongoose');

const txnSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['deposit', 'withdraw', 'commission', 'gift', 'invite', 'earning'],
        required: true,
    },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number },           // amount - fee
    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending',
    },
    ref: { type: String, unique: true },    // TXN-XXXXXX
    note: { type: String, default: '' },
    utr: { type: String, default: null },   // bank ref number
    balanceAfter: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // extra data
}, { timestamps: true });

// ── Auto ref & Calculation ──
// Removed 'next' argument and the need for next()
txnSchema.pre('save', async function () {
    if (!this.ref) {
        // Generating a readable reference like IKEA-XXXXXX
        const ts = Date.now().toString(36).toUpperCase().slice(-6);
        const prefix = this.type.slice(0, 3).toUpperCase();
        this.ref = `${prefix}-${ts}`;
    }

    if (this.netAmount === undefined) {
        this.netAmount = this.amount - (this.fee || 0);
    }
});

module.exports = mongoose.model('Transaction', txnSchema);