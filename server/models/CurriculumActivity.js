import mongoose from "mongoose";

const curriculumActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  courseSlug: { type: String, required: true, index: true }, // e.g. 'dsa', 'web-dev', 'advanced-python'
  courseTitle: { type: String, required: true },

  // Level 1: Main Section
  mainSectionId: { type: String, default: "general", index: true },
  mainSectionName: { type: String, default: "Activities" },
  mainSectionDescription: { type: String, default: "" },
  mainSectionOrder: { type: Number, default: 1 },
  mainSectionTotalContentMinutes: { type: Number, default: 0 },
  mainSectionTotalEffortMinutes: { type: Number, default: 0 },

  // Backward-compatible section aliases (always synced with main section)
  sectionNumber: { type: Number, default: 1 },
  sectionId: { type: String, default: "general", index: true },
  sectionTitle: { type: String, default: "Activities" },

  // Level 2: Subsection (Optional)
  subsectionId: { type: String, default: null },
  subsectionName: { type: String, default: "" },
  subsectionDescription: { type: String, default: "" },
  subsectionOrder: { type: Number, default: null },
  subsectionTotalContentMinutes: { type: Number, default: 0 },
  subsectionTotalEffortMinutes: { type: Number, default: 0 },

  // Level 3: Sub-subsection (Optional)
  subSubsectionId: { type: String, default: null },
  subSubsectionName: { type: String, default: "" },
  subSubsectionDescription: { type: String, default: "" },
  subSubsectionOrder: { type: Number, default: null },
  subSubsectionTotalContentMinutes: { type: Number, default: 0 },
  subSubsectionTotalEffortMinutes: { type: Number, default: 0 },

  // Level 4: Activity Details
  activityNumber: { type: Number, required: true },
  externalActivityId: { type: String, default: "" },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  contentDurationMinutes: { type: Number, default: 0 },
  practiceMultiplier: { type: Number, default: 2.0 },
  activityMultiplierOverride: {
    type: Number,
    default: null,
    min: 0.1,
    max: 10,
  },
  activityEffortOverrideMinutes: { type: Number, default: null, min: 1 },
  dependencies: [{ type: String }],
  totalEffortMinutes: { type: Number, default: 0 },
  actualMinutes: { type: Number, default: 0, min: 0 },
  remainingMinutes: { type: Number, default: 0, min: 0 },
  activityType: {
    type: String,
    enum: [
      "lecture",
      "problem",
      "project",
      "reading",
      "speech",
      "exercise",
      "exploration",
      "research",
      "practical",
    ],
    default: "lecture",
  },
  priority: { type: String, enum: ["P1", "P2", "P3"], default: "P2" },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "medium",
  },
  confidence: { type: Number, min: 1, max: 5, default: 3 },
  isWatched: { type: Boolean, default: false },
  isCodeDone: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed", "deferred"],
    default: "pending",
    index: true,
  },
  notes: { type: String, default: "" },
  scheduledDate: { type: String, index: true }, // "YYYY-MM-DD"
  deadline: { type: String },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

curriculumActivitySchema.index(
  { userId: 1, courseSlug: 1, sectionNumber: 1, activityNumber: 1 },
  { unique: true },
);
curriculumActivitySchema.index({ userId: 1, scheduledDate: 1 });
curriculumActivitySchema.index({
  userId: 1,
  courseSlug: 1,
  mainSectionId: 1,
  subsectionId: 1,
  subSubsectionId: 1,
});

export const CurriculumActivity =
  mongoose.models.CurriculumActivity ||
  mongoose.model("CurriculumActivity", curriculumActivitySchema);
