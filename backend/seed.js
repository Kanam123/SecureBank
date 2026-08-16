const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Account = require("./models/Account");
const Transaction = require("./models/Transaction");
const generateAccountNumber = require("./utils/accountNumber");
const { assessRisk } = require("./utils/fraud");

async function ensureUser({ name, email, password, role }) {
  email = email.toLowerCase();
  let user = await User.findOne({ email });
  const passwordHash = await bcrypt.hash(password, 10);
  if (!user) {
    user = await User.create({ name, email, passwordHash, role });
  } else if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.passwordHash = passwordHash;
    user.role = role;
    await user.save();
  }
  let account = await Account.findOne({ userId: user._id });
  if (!account) {
    account = await Account.create({
      userId: user._id,
      accountNumber: await generateAccountNumber(),
      accountType: "savings",
      balance: 0,
    });
  }
  return { user, account };
}

async function recordTxn(user, account, type, amount, extra = {}) {
  const balanceBefore = account.balance;
  const risk = await assessRisk({ userId: user._id, amount, balanceBefore, type });
  if (type === "deposit" || type === "transfer_in") account.balance += amount;
  else account.balance -= amount;
  await account.save();
  await Transaction.create({
    userId: user._id,
    accountId: account._id,
    accountNumber: account.accountNumber,
    type,
    amount,
    balanceAfter: account.balance,
    ...extra,
    riskLevel: extra.forceRisk || risk.riskLevel,
    flagged: extra.forceRisk ? extra.forceRisk !== "LOW" : risk.flagged,
    fraudReasons: extra.reasons || risk.fraudReasons,
  });
}

async function seed() {
  const admin = await ensureUser({
    name: process.env.ADMIN_NAME || "Admin",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
  });
  const demo = await ensureUser({
    name: process.env.DEMO_USER_NAME || "Demo User",
    email: process.env.DEMO_USER_EMAIL,
    password: process.env.DEMO_USER_PASSWORD,
    role: "user",
  });

  // Seed demo transactions only once
  const existingTxns = await Transaction.countDocuments({ userId: demo.user._id });
  if (existingTxns === 0) {
    const u = demo.user;
    const a = demo.account;
    await recordTxn(u, a, "deposit", 50000, { description: "Salary credit" });
    await recordTxn(u, a, "deposit", 12000, { description: "Freelance payment" });
    await recordTxn(u, a, "withdraw", 3500, { description: "ATM withdrawal" });
    await recordTxn(u, a, "transfer_out", 8000, {
      description: "Rent payment",
      counterpartyAccount: admin.account.accountNumber,
      counterpartyName: admin.user.name,
    });
    await recordTxn(u, a, "deposit", 150000, {
      description: "Property sale advance",
      forceRisk: "HIGH",
      reasons: ["Unusually large transaction (₹1,00,000 or more)"],
    });
    console.log("[seed] Demo transactions created");
  }

  console.log("[seed] Admin & demo user ready");
}

module.exports = seed;
