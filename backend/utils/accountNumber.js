const Account = require("../models/Account");

// Generate a unique 12-digit account number
async function generateAccountNumber() {
  for (let i = 0; i < 10; i++) {
    const num = String(Math.floor(100000000000 + Math.random() * 899999999999));
    const exists = await Account.findOne({ accountNumber: num }).lean();
    if (!exists) return num;
  }
  throw new Error("Failed to generate unique account number");
}

module.exports = generateAccountNumber;
