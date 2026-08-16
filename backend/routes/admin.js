const express = require("express");
const User = require("../models/User");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();
router.use(protect, adminOnly);

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  const [userCount, accountCount, txnCount, flaggedCount, accounts, txns] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Account.countDocuments(),
    Transaction.countDocuments(),
    Transaction.countDocuments({ flagged: true }),
    Account.find(),
    Transaction.find(),
  ]);
  const totalDeposits = accounts.reduce((s, a) => s + a.balance, 0);
  const totalVolume = txns.reduce((s, t) => s + t.amount, 0);
  const highRisk = await Transaction.countDocuments({ riskLevel: "HIGH" });
  res.json({
    userCount,
    accountCount,
    txnCount,
    flaggedCount,
    highRisk,
    totalDeposits,
    totalVolume,
  });
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  const { q } = req.query;
  const query = {};
  if (q) {
    const re = new RegExp(String(q).trim(), "i");
    query.$or = [{ name: re }, { email: re }];
  }
  const users = await User.find(query).sort({ createdAt: -1 });
  const accounts = await Account.find();
  const balanceByUser = {};
  accounts.forEach((a) => {
    const id = a.userId.toString();
    balanceByUser[id] = (balanceByUser[id] || 0) + a.balance;
  });
  res.json({
    users: users.map((u) => ({ ...u.toJSON(), totalBalance: balanceByUser[u._id.toString()] || 0 })),
  });
});

// PUT /api/admin/users/:id  -> update role/status
router.put("/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const { role, status } = req.body || {};
  if (role && ["user", "admin"].includes(role)) user.role = role;
  if (status && ["active", "suspended"].includes(status)) user.status = status;
  await user.save();
  res.json({ user: user.toJSON() });
});

// GET /api/admin/accounts
router.get("/accounts", async (req, res) => {
  const accounts = await Account.find().sort({ createdAt: -1 });
  const users = await User.find();
  const userMap = {};
  users.forEach((u) => (userMap[u._id.toString()] = u));
  res.json({
    accounts: accounts.map((a) => {
      const u = userMap[a.userId.toString()];
      return { ...a.toJSON(), ownerName: u ? u.name : "Unknown", ownerEmail: u ? u.email : "" };
    }),
  });
});

// GET /api/admin/transactions
router.get("/transactions", async (req, res) => {
  const { type, riskLevel } = req.query;
  const query = {};
  if (type && type !== "all") query.type = type;
  if (riskLevel && riskLevel !== "all") query.riskLevel = riskLevel;
  const txns = await Transaction.find(query).sort({ createdAt: -1 }).limit(500);
  const users = await User.find();
  const userMap = {};
  users.forEach((u) => (userMap[u._id.toString()] = u));
  res.json({
    transactions: txns.map((t) => {
      const u = userMap[t.userId.toString()];
      return { ...t.toJSON(), ownerName: u ? u.name : "Unknown", ownerEmail: u ? u.email : "" };
    }),
  });
});

// GET /api/admin/suspicious
router.get("/suspicious", async (req, res) => {
  const txns = await Transaction.find({ flagged: true }).sort({ createdAt: -1 }).limit(500);
  const users = await User.find();
  const userMap = {};
  users.forEach((u) => (userMap[u._id.toString()] = u));
  res.json({
    transactions: txns.map((t) => {
      const u = userMap[t.userId.toString()];
      return { ...t.toJSON(), ownerName: u ? u.name : "Unknown", ownerEmail: u ? u.email : "" };
    }),
  });
});

module.exports = router;
