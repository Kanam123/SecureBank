const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    accountNumber: { type: String, required: true },
    type: {
      type: String,
      enum: ["deposit", "withdraw", "transfer_out", "transfer_in"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    description: { type: String, default: "" },
    counterpartyAccount: { type: String, default: "" },
    counterpartyName: { type: String, default: "" },
    status: { type: String, enum: ["completed", "failed"], default: "completed" },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
    flagged: { type: Boolean, default: false },
    fraudReasons: { type: [String], default: [] },
  },
  { timestamps: true }
);

transactionSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
