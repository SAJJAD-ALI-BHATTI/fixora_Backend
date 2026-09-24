const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const { getPlatformCommissionPercent, calculateCommission, calculateProviderAmount } = require("../config/payment");
const { getOrCreateWallet } = require("./wallet");
const { createNotification } = require("./notification");
const { generateReference } = require("./transaction");

async function settleMarketplacePayment({ customerId, providerId, providerRole, amount, bookingId = null, taskId = null, serviceId = null, description, finalize }) {
  const total = Number(amount);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid payment amount");
  if (!["vendor", "taskRunner"].includes(providerRole)) throw new Error("Invalid provider role");

  const commissionPercent = await getPlatformCommissionPercent();
  const commission = calculateCommission(total, commissionPercent);
  const providerAmount = calculateProviderAmount(total, commissionPercent);
  const session = await mongoose.startSession();
  let transaction;

  try {
    await session.withTransaction(async () => {
      const existingFilter = bookingId
        ? { booking: bookingId, type: "bookingPayment", status: "paid" }
        : { task: taskId, type: "taskPayment", status: "paid" };
      const existing = await Transaction.findOne(existingFilter).session(session);
      if (existing) throw new Error("This order has already been paid.");

      const customerWallet = await getOrCreateWallet(customerId, session);
      if (customerWallet.balance < total) {
        throw new Error(`Insufficient wallet balance. Required PKR ${total.toLocaleString()} but available balance is PKR ${Number(customerWallet.balance).toLocaleString()}.`);
      }
      customerWallet.balance -= total;
      customerWallet.totalSpent += total;
      await customerWallet.save({ session });

      const providerWallet = await getOrCreateWallet(providerId, session);
      providerWallet.balance += providerAmount;
      providerWallet.totalEarned += providerAmount;
      await providerWallet.save({ session });

      const docs = await Transaction.create([{
        customer: customerId,
        vendor: providerRole === "vendor" ? providerId : null,
        taskRunner: providerRole === "taskRunner" ? providerId : null,
        booking: bookingId,
        task: taskId,
        service: serviceId,
        type: bookingId ? "bookingPayment" : "taskPayment",
        amount: total,
        platformCommission: commission,
        providerAmount,
        currency: "PKR",
        paymentMethod: "wallet",
        status: "paid",
        reference: generateReference(),
        description: description || "Marketplace payment",
        metadata: { settlement: "customer-confirmed", commissionPercent },
        paidAt: new Date()
      }], { session });
      transaction = docs[0];

      if (typeof finalize === "function") {
        await finalize({ session, transaction });
      }
    });

    // Notifications must never turn a successful payment into a false 500 response.
    try {
      await createNotification({
        recipient: providerId,
        sender: customerId,
        type: "system",
        title: "Payment Received",
        message: `PKR ${providerAmount.toLocaleString()} has been added to your earnings after platform commission.`,
        data: { transactionId: transaction._id, reference: transaction.reference }
      });
      await createNotification({
        recipient: customerId,
        type: "system",
        title: "Payment Confirmed",
        message: `Your payment of PKR ${total.toLocaleString()} was completed successfully.`,
        data: { transactionId: transaction._id, reference: transaction.reference }
      });
    } catch (notificationError) {
      console.error("Payment notification failed:", notificationError.message);
    }

    return transaction;
  } finally {
    await session.endSession();
  }
}

module.exports = { settleMarketplacePayment };
