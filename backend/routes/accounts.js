const express = require("express");
const Account = require("../models/Account");
const generateAccountNumber = require("../utils/accountNumber");
const { protect } = require("../middleware/auth");

const router = express.Router();

// POST /api/accounts  -> create a new bank account
router.post("/", protect, async (req, res) => {
  try {
    const { accountType } = req.body || {};
    const type = ["savings", "current"].includes(accountType) ? accountType : "savings";
    const accountNumber = await generateAccountNumber();
    const account = await Account.create({
      userId: req.user._id,
      accountNumber,
      accountType: type,
      balance: 0,
    });
    res.status(201).json({ account: account.toJSON() });
  } catch (err) {
    console.error("[create account]", err);
    res.status(500).json({ message: "Failed to create account" });
  }
});

// GET /api/accounts -> list current user's accounts
router.get("/", protect, async (req, res) => {
  const accounts = await Account.find({ userId: req.user._id }).sort({ createdAt: 1 });
  res.json({ accounts: accounts.map((a) => a.toJSON()) });
});

// GET /api/accounts/:id
router.get("/:id", protect, async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.status(404).json({ message: "Account not found" });
  if (account.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You do not have access to this account" });
  }
  res.json({ account: account.toJSON() });
});

// GET /api/accounts/:id/balance
router.get("/:id/balance", protect, async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.status(404).json({ message: "Account not found" });
  if (account.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You do not have access to this account" });
  }
  res.json({ balance: account.balance, accountNumber: account.accountNumber });
});

module.exports = router;
