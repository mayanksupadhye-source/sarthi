import mongoose from "mongoose";

const savingsDepositSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    serialNumber: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    dateKey: { type: String, required: true },
    message: { type: String, default: "", maxlength: 50 },
    amount: { type: Number, required: true, min: 0.01 },
    source: { type: String, default: "personal-savings" },
    legacyContributionId: { type: String, default: undefined },
    submissionKey: { type: String, default: undefined },
  },
  { timestamps: true },
);

savingsDepositSchema.index({ userId: 1, serialNumber: 1 }, { unique: true });
savingsDepositSchema.index(
  { userId: 1, legacyContributionId: 1 },
  {
    unique: true,
    partialFilterExpression: { legacyContributionId: { $type: "string" } },
  },
);
savingsDepositSchema.index(
  { userId: 1, submissionKey: 1 },
  {
    unique: true,
    partialFilterExpression: { submissionKey: { $type: "string" } },
  },
);
savingsDepositSchema.index({ userId: 1, date: -1, serialNumber: -1 });

export const SavingsDeposit =
  mongoose.models.SavingsDeposit ||
  mongoose.model("SavingsDeposit", savingsDepositSchema);
