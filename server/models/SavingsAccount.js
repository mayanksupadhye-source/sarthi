import mongoose from "mongoose";

const savingsAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    targetAmount: { type: Number, default: 5000, min: 1 },
    lastDepositNumber: { type: Number, default: 0, min: 0 },
    goalCompletedAt: { type: Date, default: null },
    legacyMigratedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const SavingsAccount =
  mongoose.models.SavingsAccount ||
  mongoose.model("SavingsAccount", savingsAccountSchema);
