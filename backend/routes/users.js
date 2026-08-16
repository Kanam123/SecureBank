const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

// GET /api/users/profile
router.get("/profile", protect, async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

// PUT /api/users/profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, phone, address } = req.body || {};
    if (name !== undefined) req.user.name = String(name).trim();
    if (phone !== undefined) req.user.phone = String(phone).trim();
    if (address !== undefined) req.user.address = String(address).trim();
    await req.user.save();
    res.json({ user: req.user.toJSON() });
  } catch (err) {
    console.error("[update profile]", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

module.exports = router;
