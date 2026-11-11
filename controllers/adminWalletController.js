const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { creditBalance } = require("../utils/wallet");
const { generateReference } = require("../utils/transaction");

const getCustomerWallets = async (req, res, next) => {
  try {
    const customers = await User.find({ role: "customer" }).select("name email phone profileImage status").sort({ createdAt: -1 }).lean();
    const wallets = await Wallet.find({ user: { $in: customers.map(c => c._id) } }).lean();
    const map = new Map(wallets.map(w => [String(w.user), w]));
    const data = customers.map(customer => ({ customer, wallet: map.get(String(customer._id)) || { balance: 0, totalDeposited: 0, totalSpent: 0 } }));
    res.json({ success: true, data: { customers: data } });
  } catch (error) { next(error); }
};

const creditCustomerWallet = async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Enter a valid amount greater than zero." });
    const customer = await User.findOne({ _id: req.params.userId, role: "customer" });
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const wallet = await creditBalance(customer._id, amount);
    const transaction = await Transaction.create({
      customer: customer._id,
      type: "walletTopUp",
      amount,
      providerAmount: amount,
      currency: "PKR",
      paymentMethod: "adminCredit",
      status: "paid",
      reference: generateReference(),
      description: `Wallet credited manually by administrator${req.body.note ? `: ${String(req.body.note).trim()}` : ""}`,
      metadata: { adminId: req.user._id, note: req.body.note || "" },
      paidAt: new Date()
    });
    res.status(200).json({ success: true, message: `PKR ${amount.toLocaleString()} added to ${customer.name}'s wallet.`, data: { customer, wallet, transaction } });
  } catch (error) { next(error); }
};

module.exports = { getCustomerWallets, creditCustomerWallet };
