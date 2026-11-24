import mongoose from "mongoose";

const executionRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  courseSlug: { type: String, index: true }, // e.g. 'dsa', 'web-dev', 'machine-learning'
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CurriculumActivity",
    index: true,
  },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", index: true },
  module: {
    type: String,
    enum: [
      "course",
      "exploration",
      "academic",
      "reading",
      "oratory",
      "hackathon",
      "fitness",
      "general",
    ],
    default: "course",
  },
  date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
  minutesSpent: { type: Number, required: true, min: 1 },
  type: {
    type: String,
    enum: ["regular", "recovery", "revision", "practice", "focus"],
    default: "regular",
  },
  notes: { type: String, default: "", trim: true },
  createdAt: { type: Date, default: Date.now },
});

executionRecordSchema.index({ userId: 1, date: 1 });
executionRecordSchema.index({ userId: 1, courseSlug: 1 });
executionRecordSchema.index({ userId: 1, taskId: 1 });

export const ExecutionRecord =
  mongoose.models.ExecutionRecord ||
  mongoose.model("ExecutionRecord", executionRecordSchema);
