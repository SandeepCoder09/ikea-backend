// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    uid: { type: String, unique: true },        // IKEA-XXXX
    referralCode: { type: String, unique: true },        // their own code
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    walletBalance: { type: Number, default: 0 },
    lastCheckIn: { type: Date, default: null },
    withdrawPin: { type: String, default: null },       // hashed 4-digit PIN
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    bankAccount: {
        holderName: { type: String, default: null },
        bankName: { type: String, default: null },
        accNumber: { type: String, default: null },        // store encrypted/masked
        ifsc: { type: String, default: null },
        isLinked: { type: Boolean, default: false },
    },
    totalDeposited: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
}, { timestamps: true });

// ── Auto-generate UID & referralCode ──
userSchema.pre('save', async function (next) {
    if (this.isNew) {
        const count = await mongoose.model('User').countDocuments();
        this.uid = `IKEA-${String(count + 1001).padStart(4, '0')}`;
        this.referralCode = `IKEA${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    }
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    if (this.isModified('withdrawPin') && this.withdrawPin) {
        this.withdrawPin = await bcrypt.hash(this.withdrawPin, 10);
    }
});

// ── Compare password ──
userSchema.methods.comparePassword = function (plain) {
    return bcrypt.compare(plain, this.password);
};

// ── Compare PIN ──
userSchema.methods.comparePin = function (plain) {
    return bcrypt.compare(plain, this.withdrawPin);
};

// ── Never send password/pin in JSON ──
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.withdrawPin;
    return obj;
};

module.exports = mongoose.model('User', userSchema);