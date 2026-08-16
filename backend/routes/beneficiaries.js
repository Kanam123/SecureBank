const express = require("express");
const Beneficiary = require("../models/Beneficiary");
const Account = require("../models/Account");
const { protect } = require("../middleware/auth");

const router = express.Router();

// GET /api/beneficiaries
router.get("/", protect, async (req, res) => {
  const items = await Beneficiary.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ beneficiaries: items.map((b) => b.toJSON()) });
});

// POST /api/beneficiaries
router.post("/", protect, async (req, res) => {
  try {
    const { name, accountNumber, nickname } = req.body || {};
    if (!name || !accountNumber) {
      return res.status(400).json({ message: "Name and account number are required" });
    }
    const acc = String(accountNumber).trim();
    const target = await Account.findOne({ accountNumber: acc });
    if (!target) return res.status(404).json({ message: "No SecureBank account found with this number" });
    if (target.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot add your own account as a beneficiary" });
    }
    const exists = await Beneficiary.findOne({ userId: req.user._id, accountNumber: acc });
    if (exists) return res.status(409).json({ message: "This beneficiary is already saved" });

    const beneficiary = await Beneficiary.create({
      userId: req.user._id,
      name: String(name).trim(),
      accountNumber: acc,
      nickname: nickname ? String(nickname).trim() : "",
    });
    res.status(201).json({ beneficiary: beneficiary.toJSON() });
  } catch (err) {
    console.error("[create beneficiary]", err);
    res.status(500).json({ message: "Failed to add beneficiary" });
  }
});

// DELETE /api/beneficiaries/:id
router.delete("/:id", protect, async (req, res) => {
  const b = await Beneficiary.findById(req.params.id);
  if (!b) return res.status(404).json({ message: "Beneficiary not found" });
  if (b.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not allowed" });
  }
  await b.deleteOne();
  res.json({ message: "Beneficiary removed" });
});

module.exports = router;
