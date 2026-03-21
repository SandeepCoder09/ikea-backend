// models/BankAccount.js
const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    holderName: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    accNumber: { type: String, required: true },   // store last4 only / encrypted
    ifsc: { type: String, required: true, uppercase: true, trim: true },
    isVerified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('BankAccount', bankAccountSchema);