const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountNumber: { type: String, required: true, unique: true },
    accountType: { type: String, enum: ["savings", "current"], default: "savings" },
    balance: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "frozen"], default: "active" },
  },
  { timestamps: true }
);

accountSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Account", accountSchema);
