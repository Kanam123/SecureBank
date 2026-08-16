const mongoose = require("mongoose");

const beneficiarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true },
    nickname: { type: String, default: "" },
    bankName: { type: String, default: "SecureBank" },
  },
  { timestamps: true }
);

beneficiarySchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Beneficiary", beneficiarySchema);
