const Wallet = require("../models/Wallet");

const getOrCreateWallet = async (userId, session = null) => {
  const query = Wallet.findOne({ user: userId });
  if (session) query.session(session);
  let wallet = await query;
  if (!wallet) {
    wallet = await Wallet.create([{ user: userId }], session ? { session } : undefined);
    wallet = Array.isArray(wallet) ? wallet[0] : wallet;
  }
  return wallet;
};

const addEarnings = async (userId, amount, session = null) => {
  if (amount <= 0) throw new Error("Earning amount must be greater than zero");
  const wallet = await getOrCreateWallet(userId, session);
  wallet.balance += amount;
  wallet.totalEarned += amount;
  await wallet.save(session ? { session } : undefined);
  return wallet;
};

const creditBalance = async (userId, amount, session = null) => {
  if (amount <= 0) throw new Error("Credit amount must be greater than zero");
  const wallet = await getOrCreateWallet(userId, session);
  wallet.balance += amount;
  wallet.totalDeposited += amount;
  await wallet.save(session ? { session } : undefined);
  return wallet;
};

const deductForPurchase = async (userId, amount, session = null) => {
  if (amount <= 0) throw new Error("Payment amount must be greater than zero");
  const wallet = await getOrCreateWallet(userId, session);
  if (wallet.balance < amount) throw new Error("Insufficient wallet balance. Please ask the administrator to add funds to your account.");
  wallet.balance -= amount;
  wallet.totalSpent += amount;
  await wallet.save(session ? { session } : undefined);
  return wallet;
};

const moveToPendingBalance = async (userId, amount, session = null) => {
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  const wallet = await getOrCreateWallet(userId, session);
  wallet.pendingBalance += amount;
  await wallet.save(session ? { session } : undefined);
  return wallet;
};

const releasePendingBalance = async (userId, amount, session = null) => {
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  const wallet = await getOrCreateWallet(userId, session);
  if (wallet.pendingBalance < amount) throw new Error("Insufficient pending balance");
  wallet.pendingBalance -= amount;
  wallet.balance += amount;
  wallet.totalEarned += amount;
  await wallet.save(session ? { session } : undefined);
  return wallet;
};

const deductBalance = async (userId, amount, session = null) => {
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  const wallet = await getOrCreateWallet(userId, session);
  if (wallet.balance < amount) throw new Error("Insufficient wallet balance");
  wallet.balance -= amount;
  wallet.totalWithdrawn += amount;
  await wallet.save(session ? { session } : undefined);
  return wallet;
};

module.exports = { getOrCreateWallet, addEarnings, creditBalance, deductForPurchase, moveToPendingBalance, releasePendingBalance, deductBalance };
