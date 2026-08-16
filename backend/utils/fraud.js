// Basic suspicious-transaction detection engine.
// Rules: unusually large amounts, transactions draining most of the balance,
// and multiple rapid transactions in a short window.
const Transaction = require("../models/Transaction");

const LARGE_AMOUNT = 100000; // ₹1,00,000
const MEDIUM_AMOUNT = 50000; // ₹50,000
const RAPID_WINDOW_MS = 60 * 1000; // 60 seconds
const RAPID_COUNT = 3;

async function assessRisk({ userId, amount, balanceBefore, type }) {
  const reasons = [];
  let score = 0;

  if (amount >= LARGE_AMOUNT) {
    score += 3;
    reasons.push("Unusually large transaction (₹1,00,000 or more)");
  } else if (amount >= MEDIUM_AMOUNT) {
    score += 2;
    reasons.push("Large transaction (₹50,000 or more)");
  }

  if ((type === "withdraw" || type === "transfer_out") && balanceBefore > 0 && amount > 0.8 * balanceBefore) {
    score += 2;
    reasons.push("Transaction drains over 80% of available balance");
  }

  const since = new Date(Date.now() - RAPID_WINDOW_MS);
  const recentCount = await Transaction.countDocuments({ userId, createdAt: { $gte: since } });
  if (recentCount >= RAPID_COUNT) {
    score += 2;
    reasons.push("Multiple rapid transactions detected in a short window");
  }

  let riskLevel = "LOW";
  if (score >= 4) riskLevel = "HIGH";
  else if (score >= 2) riskLevel = "MEDIUM";

  return { riskLevel, flagged: riskLevel !== "LOW", fraudReasons: reasons };
}

module.exports = { assessRisk };
