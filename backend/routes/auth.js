const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Account = require("../models/Account");
const generateToken = require("../utils/generateToken");
const generateAccountNumber = require("../utils/accountNumber");
const { protect } = require("../middleware/auth");

const router = express.Router();

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    let { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    email = String(email).toLowerCase().trim();
    if (!emailRe.test(email)) return res.status(400).json({ message: "Please enter a valid email address" });
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email, passwordHash, role: "user" });

    // Auto-create a default savings account for new users
    const accountNumber = await generateAccountNumber();
    await Account.create({ userId: user._id, accountNumber, accountType: "savings", balance: 0 });

    const token = generateToken(user);
    res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ message: "Failed to register" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    email = String(email).toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });
    if (user.status === "suspended") return res.status(403).json({ message: "Your account has been suspended" });
    const token = generateToken(user);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ message: "Failed to login" });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

module.exports = router;
