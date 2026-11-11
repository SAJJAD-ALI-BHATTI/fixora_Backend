const mongoose = require("mongoose");

// Proof-of-ownership codes sent to an email address during sign-up.
const schema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    codeHash: { type: String, default: null },
    codeExpiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 0 },
    windowStart: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    purgeAt: { type: Date, required: true }
}, { timestamps: true });

schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("EmailVerification", schema);
