import mongoose from "mongoose";

const recoveryHistorySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    minutesRecovered: { type: Number, required: true },
    notes: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const recoveryLedgerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  sourceDate: { type: String, required: true, index: true }, // "YYYY-MM-DD" when the work was missed
  title: { type: String, required: true },
  courseSlug: { type: String, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CurriculumActivity",
  },
  originalMissedMinutes: { type: Number, required: true, min: 1 },
  recoveredMinutes: { type: Number, default: 0, min: 0 },
  remainingRecoveryMinutes: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["active", "partial", "recovered", "forgiven"],
    default: "active",
    index: true,
  },
  history: [recoveryHistorySchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

recoveryLedgerSchema.index({ userId: 1, status: 1 });

export const RecoveryLedger =
  mongoose.models.RecoveryLedger ||
  mongoose.model("RecoveryLedger", recoveryLedgerSchema);
