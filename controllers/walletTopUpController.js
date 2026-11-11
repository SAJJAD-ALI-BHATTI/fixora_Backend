const WalletTopUpRequest = require("../models/WalletTopUpRequest");
const Transaction = require("../models/Transaction");
const { creditBalance } = require("../utils/wallet");
const { generateReference } = require("../utils/transaction");

const bankInstructions = async (req, res) => res.json({ success: true, data: { bank: "Meezan Bank", accountTitle: process.env.MEEZAN_ACCOUNT_TITLE || "Fixora (configure account title)", accountNumber: process.env.MEEZAN_ACCOUNT_NUMBER || "", iban: process.env.MEEZAN_IBAN || "", branch: process.env.MEEZAN_BRANCH || "", configured: Boolean(process.env.MEEZAN_ACCOUNT_NUMBER || process.env.MEEZAN_IBAN) } });

const createTopUpRequest = async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const senderName = String(req.body.senderName || "").trim();
    const receiptUrl = String(req.body.receiptUrl || "").trim();
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000000) return res.status(400).json({ success: false, message: "Enter an amount between PKR 1 and PKR 10,000,000." });
    if (!senderName) return res.status(400).json({ success: false, message: "Enter the name used for the bank transfer." });
    if (!/^https:\/\//i.test(receiptUrl)) return res.status(400).json({ success: false, message: "Upload a receipt image before submitting the request." });
    const request = await WalletTopUpRequest.create({ customer: req.user._id, amount, senderName, senderAccount: String(req.body.senderAccount || "").trim(), bankReference: String(req.body.bankReference || "").trim(), message: String(req.body.message || "").trim(), receiptUrl });
    res.status(201).json({ success: true, message: "Deposit request submitted. Your wallet will be credited after the admin verifies the receipt.", data: { request } });
  } catch (e) { next(e); }
};

const getMyTopUpRequests = async (req, res, next) => {
  try { const requests = await WalletTopUpRequest.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(); res.json({ success: true, data: { requests } }); } catch (e) { next(e); }
};

const getAdminTopUpRequests = async (req, res, next) => {
  try { const requests = await WalletTopUpRequest.find().populate("customer", "name email phone").populate("reviewedBy", "name").sort({ createdAt: -1 }).limit(200).lean(); res.json({ success: true, data: { requests } }); } catch (e) { next(e); }
};

const reviewTopUpRequest = async (req, res, next) => {
  let claimed = false;
  let walletCredited = false;
  try {
    const status = String(req.body.status || "");
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "Choose approve or reject." });
    const request = await WalletTopUpRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "processing", reviewedBy: req.user._id } },
      { new: true }
    );
    if (!request) {
      const existing = await WalletTopUpRequest.findById(req.params.id).select("status");
      return res.status(existing ? 409 : 404).json({ success: false, message: existing ? "This request is already being reviewed or has been reviewed." : "Deposit request not found." });
    }
    claimed = true;
    if (status === "approved") {
      await creditBalance(request.customer, request.amount);
      walletCredited = true;
      const transaction = await Transaction.create({ customer: request.customer, type: "walletTopUp", amount: request.amount, providerAmount: request.amount, currency: "PKR", paymentMethod: "bankTransfer", status: "paid", reference: generateReference(), description: "Wallet deposit approved after Meezan Bank transfer receipt review", metadata: { topUpRequestId: String(request._id), bankReference: request.bankReference }, paidAt: new Date() });
      request.transaction = transaction._id;
    }
    request.status = status;
    request.adminNote = String(req.body.adminNote || "").trim().slice(0, 1000);
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();
    res.json({ success: true, message: status === "approved" ? `PKR ${request.amount.toLocaleString()} credited to the customer wallet.` : "Deposit request rejected.", data: { request } });
  } catch (e) {
    // Do not make a credited request retryable: this prevents double credits if transaction logging fails.
    if (claimed && !walletCredited) await WalletTopUpRequest.updateOne({ _id: req.params.id, status: "processing" }, { $set: { status: "pending" } }).catch(() => {});
    next(e);
  }
};

module.exports = { bankInstructions, createTopUpRequest, getMyTopUpRequests, getAdminTopUpRequests, reviewTopUpRequest };
