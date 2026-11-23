import mongoose from "mongoose";

const HACKATHON_STAGE_KEYS = [
  "registered",
  "ideation",
  "proposal",
  "prototype",
  "demo",
  "pitch",
];

const stageSchema = new mongoose.Schema(
  {
    key: { type: String, enum: HACKATHON_STAGE_KEYS, required: true },
    name: { type: String, required: true },
    availability: {
      type: String,
      enum: ["scheduled", "none"],
      default: "scheduled",
    },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    // Kept for compatibility with older milestone records.
    deadline: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    deliverable: { type: String, default: "" },
  },
  { _id: false },
);

const hackathonSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    tagline: { type: String, default: "" },
    theme: { type: String, default: "" },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    registrationDeadline: { type: String },
    currentStage: {
      type: String,
      enum: HACKATHON_STAGE_KEYS.concat(["completed"]),
      default: "registered",
    },
    lifecycleStatus: {
      type: String,
      enum: [
        "upcoming",
        "active",
        "submission-due",
        "submitted",
        "completed",
        "expired",
      ],
      default: "upcoming",
      index: true,
    },
    submissionStatus: {
      type: String,
      enum: ["not-submitted", "submitted", "completed"],
      default: "not-submitted",
    },
    submittedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    priority: { type: String, enum: ["P1", "P2", "P3"], default: "P2" },
    teamMembers: [
      {
        name: { type: String, required: true },
        role: { type: String, required: true },
        contact: { type: String, default: "" },
      },
    ],
    stages: { type: [stageSchema], default: [] },
    weeklyEffortBudgetHours: { type: Number, default: 6, min: 0.5, max: 40 },
    repoUrl: { type: String, default: "" },
    liveDemoUrl: { type: String, default: "" },
    pitchDeckUrl: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

hackathonSchema.index({ userId: 1, lifecycleStatus: 1, createdAt: 1 });

export const Hackathon =
  mongoose.models.Hackathon || mongoose.model("Hackathon", hackathonSchema);
