const mongoose = require("mongoose");

// One document per email. Holds the hashed OTP plus the counters that
// enforce expiry, resend cooldown/limits and wrong-attempt lockouts.
const passwordOtpSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 0 },
    windowStart: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    purgeAt: { type: Date, required: true }
}, { timestamps: true });

passwordOtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PasswordOtp", passwordOtpSchema);
