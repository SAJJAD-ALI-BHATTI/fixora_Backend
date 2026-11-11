const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    pendingBalance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    totalDeposited: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wallet", walletSchema);
