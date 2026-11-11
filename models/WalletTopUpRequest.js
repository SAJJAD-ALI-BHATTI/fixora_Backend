const mongoose = require("mongoose");

const walletTopUpRequestSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  senderName: { type: String, required: true, trim: true, maxlength: 120 },
  senderAccount: { type: String, default: "", trim: true, maxlength: 80 },
  bankReference: { type: String, default: "", trim: true, maxlength: 120 },
  message: { type: String, default: "", trim: true, maxlength: 1000 },
  receiptUrl: { type: String, required: true, trim: true },
  status: { type: String, enum: ["pending", "processing", "approved", "rejected"], default: "pending", index: true },
  adminNote: { type: String, default: "", trim: true, maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null }
}, { timestamps: true });
walletTopUpRequestSchema.index({ customer: 1, createdAt: -1 });
module.exports = mongoose.model("WalletTopUpRequest", walletTopUpRequestSchema);
