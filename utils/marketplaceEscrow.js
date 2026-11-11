const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { getPlatformCommissionPercent, calculateCommission, calculateProviderAmount } = require("../config/payment");
const { generateReference } = require("./transaction");

async function reserveMarketplacePayment({ customerId, providerId, providerRole, amount, bookingId = null, taskId = null, serviceId = null, description = "Marketplace reservation" }) {
  const total = Number(amount);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid payment amount");
  if (!["vendor", "taskRunner"].includes(providerRole)) throw new Error("Invalid provider role");
  const session = await mongoose.startSession();
  let transaction;
  try {
    await session.withTransaction(async () => {
      const existingFilter = bookingId ? { booking: bookingId, type: "bookingPayment", status: { $in: ["processing", "paid"] } } : { task: taskId, type: "taskPayment", status: { $in: ["processing", "paid"] } };
      const existing = await Transaction.findOne(existingFilter).session(session);
      if (existing) {
        if (existing.status === "paid") throw new Error("This order has already been paid.");
        transaction = existing;
        return;
      }
      let wallet = await Wallet.findOne({ user: customerId }).session(session);
      if (!wallet) [wallet] = await Wallet.create([{ user: customerId }], { session });
      if (wallet.balance < total) throw new Error(`Insufficient wallet balance. Required PKR ${total.toLocaleString()} but available balance is PKR ${Number(wallet.balance).toLocaleString()}.`);
      wallet.balance -= total;
      wallet.pendingBalance = Number(wallet.pendingBalance || 0) + total;
      wallet.totalSpent += total;
      await wallet.save({ session });
      const percent = await getPlatformCommissionPercent();
      const commission = calculateCommission(total, percent);
      const providerAmount = calculateProviderAmount(total, percent);
      const [created] = await Transaction.create([{
        customer: customerId, vendor: providerRole === "vendor" ? providerId : null,
        taskRunner: providerRole === "taskRunner" ? providerId : null,
        booking: bookingId, task: taskId, service: serviceId,
        type: bookingId ? "bookingPayment" : "taskPayment", amount: total,
        platformCommission: commission, providerAmount, currency: "PKR", paymentMethod: "wallet",
        status: "processing", reference: generateReference(), description,
        metadata: { settlement: "reserved-on-acceptance", commissionPercent: percent },
      }], { session });
      transaction = created;
    });
    return transaction;
  } finally { await session.endSession(); }
}

async function refundMarketplaceReservation({ transactionId, customerId }) {
  if (!transactionId) return false;
  const session = await mongoose.startSession();
  let refunded = false;
  try {
    await session.withTransaction(async () => {
      const transaction = await Transaction.findById(transactionId).session(session);
      if (!transaction || transaction.status !== "processing") return;
      const wallet = await Wallet.findOne({ user: customerId }).session(session);
      if (!wallet || Number(wallet.pendingBalance || 0) < transaction.amount) throw new Error("Reserved wallet funds could not be refunded safely.");
      wallet.pendingBalance = Number(wallet.pendingBalance || 0) - transaction.amount;
      wallet.balance += transaction.amount;
      wallet.totalSpent = Math.max(0, wallet.totalSpent - transaction.amount);
      await wallet.save({ session });
      transaction.status = "refunded";
      transaction.metadata = { ...(transaction.metadata || {}), settlement: "refunded-after-cancellation" };
      await transaction.save({ session });
      refunded = true;
    });
    return refunded;
  } finally { await session.endSession(); }
}
module.exports = { reserveMarketplacePayment, refundMarketplaceReservation };
