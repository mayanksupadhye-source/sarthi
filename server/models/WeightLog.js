import mongoose from "mongoose";

const weightLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  date: { type: String, required: true }, // YYYY-MM-DD
  measurementDate: { type: Date },
  checkInNumber: { type: Number, min: 1 },
  weightKg: { type: Number, required: true, min: 30, max: 200 },
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

weightLogSchema.index({ userId: 1, date: 1 }, { unique: true });
weightLogSchema.index(
  { userId: 1, checkInNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { checkInNumber: { $type: "number" } },
  },
);

export const WeightLog =
  mongoose.models.WeightLog || mongoose.model("WeightLog", weightLogSchema);
