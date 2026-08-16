const express = require("express");
const mongoose = require("mongoose");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { assessRisk } = require("../utils/fraud");
const { protect } = require("../middleware/auth");

const router = express.Router();

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

async function ownedAccount(accountId, userId) {
  if (!mongoose.isValidObjectId(accountId)) return null;
  const account = await Account.findById(accountId);
  if (!account) return null;
  if (account.userId.toString() !== userId.toString()) return "forbidden";
  return account;
}

// POST /api/transactions/deposit
router.post("/deposit", protect, async (req, res) => {
  try {
    const { accountId, amount, description } = req.body || {};
    const amt = parseAmount(amount);
    if (!amt) return res.status(400).json({ message: "Enter a valid amount greater than zero" });
    const account = await ownedAccount(accountId, req.user._id);
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (account === "forbidden") return res.status(403).json({ message: "You do not have access to this account" });

    const balanceBefore = account.balance;
    const risk = await assessRisk({ userId: req.user._id, amount: amt, balanceBefore, type: "deposit" });
    account.balance = Math.round((balanceBefore + amt) * 100) / 100;
    await account.save();

    const txn = await Transaction.create({
      userId: req.user._id,
      accountId: account._id,
      accountNumber: account.accountNumber,
      type: "deposit",
      amount: amt,
      balanceAfter: account.balance,
      description: description || "Cash deposit",
      ...risk,
    });
    res.status(201).json({ transaction: txn.toJSON(), balance: account.balance });
  } catch (err) {
    console.error("[deposit]", err);
    res.status(500).json({ message: "Deposit failed" });
  }
});

// POST /api/transactions/withdraw
router.post("/withdraw", protect, async (req, res) => {
  try {
    const { accountId, amount, description } = req.body || {};
    const amt = parseAmount(amount);
    if (!amt) return res.status(400).json({ message: "Enter a valid amount greater than zero" });
    const account = await ownedAccount(accountId, req.user._id);
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (account === "forbidden") return res.status(403).json({ message: "You do not have access to this account" });
    if (amt > account.balance) return res.status(400).json({ message: "Insufficient balance" });

    const balanceBefore = account.balance;
    const risk = await assessRisk({ userId: req.user._id, amount: amt, balanceBefore, type: "withdraw" });
    account.balance = Math.round((balanceBefore - amt) * 100) / 100;
    await account.save();

    const txn = await Transaction.create({
      userId: req.user._id,
      accountId: account._id,
      accountNumber: account.accountNumber,
      type: "withdraw",
      amount: amt,
      balanceAfter: account.balance,
      description: description || "Cash withdrawal",
      ...risk,
    });
    res.status(201).json({ transaction: txn.toJSON(), balance: account.balance });
  } catch (err) {
    console.error("[withdraw]", err);
    res.status(500).json({ message: "Withdrawal failed" });
  }
});

// POST /api/transactions/transfer
router.post("/transfer", protect, async (req, res) => {
  try {
    const { fromAccountId, toAccountNumber, amount, description } = req.body || {};
    const amt = parseAmount(amount);
    if (!amt) return res.status(400).json({ message: "Enter a valid amount greater than zero" });
    if (!toAccountNumber) return res.status(400).json({ message: "Recipient account number is required" });

    const from = await ownedAccount(fromAccountId, req.user._id);
    if (!from) return res.status(404).json({ message: "Source account not found" });
    if (from === "forbidden") return res.status(403).json({ message: "You do not have access to this account" });

    const to = await Account.findOne({ accountNumber: String(toAccountNumber).trim() });
    if (!to) return res.status(404).json({ message: "Recipient account not found" });
    if (to._id.toString() === from._id.toString()) {
      return res.status(400).json({ message: "Cannot transfer to the same account" });
    }
    if (amt > from.balance) return res.status(400).json({ message: "Insufficient balance" });

    const balanceBefore = from.balance;
    const risk = await assessRisk({ userId: req.user._id, amount: amt, balanceBefore, type: "transfer_out" });

    const sender = await User.findById(from.userId).lean();
    const receiver = await User.findById(to.userId).lean();

    from.balance = Math.round((balanceBefore - amt) * 100) / 100;
    to.balance = Math.round((to.balance + amt) * 100) / 100;
    await from.save();
    await to.save();

    const outTxn = await Transaction.create({
      userId: from.userId,
      accountId: from._id,
      accountNumber: from.accountNumber,
      type: "transfer_out",
      amount: amt,
      balanceAfter: from.balance,
      description: description || "Fund transfer",
      counterpartyAccount: to.accountNumber,
      counterpartyName: receiver ? receiver.name : "",
      ...risk,
    });

    await Transaction.create({
      userId: to.userId,
      accountId: to._id,
      accountNumber: to.accountNumber,
      type: "transfer_in",
      amount: amt,
      balanceAfter: to.balance,
      description: description || "Fund received",
      counterpartyAccount: from.accountNumber,
      counterpartyName: sender ? sender.name : "",
      riskLevel: "LOW",
      flagged: false,
      fraudReasons: [],
    });

    res.status(201).json({ transaction: outTxn.toJSON(), balance: from.balance });
  } catch (err) {
    console.error("[transfer]", err);
    res.status(500).json({ message: "Transfer failed" });
  }
});

// GET /api/transactions  -> list with search & filters
router.get("/", protect, async (req, res) => {
  try {
    const { type, q, minAmount, maxAmount, from, to, accountId } = req.query;
    const query = { userId: req.user._id };
    if (type && type !== "all") query.type = type;
    if (accountId && mongoose.isValidObjectId(accountId)) query.accountId = accountId;
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    if (q) {
      const re = new RegExp(String(q).trim(), "i");
      query.$or = [
        { description: re },
        { counterpartyName: re },
        { counterpartyAccount: re },
        { accountNumber: re },
      ];
    }
    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).limit(500);
    res.json({ transactions: transactions.map((t) => t.toJSON()) });
  } catch (err) {
    console.error("[list transactions]", err);
    res.status(500).json({ message: "Failed to load transactions" });
  }
});

// GET /api/transactions/analytics
router.get("/analytics", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const accounts = await Account.find({ userId });
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

    const txns = await Transaction.find({ userId });
    let totalReceived = 0;
    let totalTransferred = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    const typeBreakdown = { deposit: 0, withdraw: 0, transfer_out: 0, transfer_in: 0 };

    for (const t of txns) {
      typeBreakdown[t.type] = (typeBreakdown[t.type] || 0) + t.amount;
      if (t.type === "transfer_in") totalReceived += t.amount;
      if (t.type === "transfer_out") totalTransferred += t.amount;
      if (t.type === "deposit") totalDeposited += t.amount;
      if (t.type === "withdraw") totalWithdrawn += t.amount;
    }

    // Last 6 months trend (money in vs out)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-IN", { month: "short" }),
        moneyIn: 0,
        moneyOut: 0,
      });
    }
    const monthIndex = {};
    months.forEach((m, i) => (monthIndex[m.key] = i));
    for (const t of txns) {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in monthIndex) {
        const m = months[monthIndex[key]];
        if (t.type === "deposit" || t.type === "transfer_in") m.moneyIn += t.amount;
        else m.moneyOut += t.amount;
      }
    }

    const recent = await Transaction.find({ userId }).sort({ createdAt: -1 }).limit(6);
    const flaggedCount = await Transaction.countDocuments({ userId, flagged: true });

    res.json({
      totalBalance,
      totalReceived,
      totalTransferred,
      totalDeposited,
      totalWithdrawn,
      transactionCount: txns.length,
      flaggedCount,
      accountsCount: accounts.length,
      typeBreakdown: [
        { name: "Deposits", value: typeBreakdown.deposit },
        { name: "Withdrawals", value: typeBreakdown.withdraw },
        { name: "Sent", value: typeBreakdown.transfer_out },
        { name: "Received", value: typeBreakdown.transfer_in },
      ],
      monthlyTrend: months.map((m) => ({ label: m.label, moneyIn: m.moneyIn, moneyOut: m.moneyOut })),
      recentTransactions: recent.map((t) => t.toJSON()),
    });
  } catch (err) {
    console.error("[analytics]", err);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});

module.exports = router;
