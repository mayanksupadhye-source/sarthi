import mongoose from "mongoose";

const dailyPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  dayType: { type: String, default: "weekday" },
  activeProfile: { type: String, default: "" }, // Activated timetable profile (exam, holiday, weekday, custom)
  isConfirmedSchedule: { type: Boolean, default: false }, // True if inside a manual activation or exception range; false = assumed default
  scheduleSource: { type: String, default: "assumed-default" }, // 'activation' | 'exception' | 'assumed-default'
  targetCapacityMinutes: { type: Number, default: 330 },
  allocatedMinutes: { type: Number, default: 0 },
  completedMinutes: { type: Number, default: 0 },
  tasks: [
    {
      taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
      title: { type: String },
      priority: { type: String, enum: ["P1", "P2", "P3"] },
      estimatedMinutes: { type: Number },
      remainingMinutes: { type: Number },
      actualMinutes: { type: Number, default: 0 },
      status: { type: String, default: "pending" },
      isProtected: { type: Boolean, default: false },
    },
  ],
  coursePlans: [
    {
      courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
      courseSlug: { type: String, required: true },
      courseTitle: { type: String, default: "" },
      category: { type: String, default: "course" }, // 'course' | 'exploration' | 'oratory'
      priority: { type: String, default: "P2" },
      lectureMinTarget: { type: Number, default: 0 },
      effortMinTarget: { type: Number, default: 0 },
      carryoverMin: { type: Number, default: 0 },
      startPosition: { type: String, default: "" }, // e.g. "Lecture 1 (00:00)"
      endPosition: { type: String, default: "" },   // e.g. "Lecture 2 (15:00)"
      startLectureNumber: { type: Number, default: 1 },
      endLectureNumber: { type: Number, default: 1 },
      minAcceptableMarkMin: { type: Number, default: 0 },
      lectureBreakdown: [
        {
          lectureNumber: { type: Number },
          title: { type: String },
          videoMinutes: { type: Number },
          effortMinutes: { type: Number },
        },
      ],
      source: {
        type: String,
        default: "timetable",
      },
      status: {
        type: String,
        enum: ["planned", "in-progress", "completed", "missed"],
        default: "planned",
      },
      actualMinutes: { type: Number, default: 0 },
      completedLecturesCount: { type: Number, default: 0 },
      notes: { type: String, default: "" },
    },
  ],
  isSlackDay: { type: Boolean, default: false },
  slackDayReason: { type: String, default: "" },
  reflection: {
    whatWentWell: { type: String, default: "" },
    whatStruggled: { type: String, default: "" },
    whatImprove: { type: String, default: "" },
    summary: { type: String, default: "" },
  },
  status: {
    type: String,
    enum: ["planned", "active", "recalculated", "closed"],
    default: "planned",
  },
  replanCount: { type: Number, default: 0 },
  replanHistory: [
    {
      timestamp: { type: Date, default: Date.now },
      reason: { type: String },
      proposalSummary: { type: String },
      tasksModified: { type: Number },
    },
  ],
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

dailyPlanSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyPlan =
  mongoose.models.DailyPlan || mongoose.model("DailyPlan", dailyPlanSchema);
