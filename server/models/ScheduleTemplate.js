import mongoose from "mongoose";

const scheduleBlockSchema = new mongoose.Schema(
  {
    blockId: { type: String, required: true },
    label: { type: String, required: true },
    startTime: { type: String, required: true }, // "05:00"
    endTime: { type: String, required: true }, // "07:30"
    durationMinutes: { type: Number, required: true },
    category: {
      type: String,
      enum: [
        "study",
        "college",
        "gym",
        "routine",
        "webdev",
        "dsa",
        "oratory",
        "exploration",
        "rest",
        "personal",
        "flexible",
      ],
      default: "study",
    },
    blockType: {
      type: String,
      enum: [
        "fixed_routine",
        "actionable_routine",
        "learning",
        "exploration",
        "deadline",
      ],
      default: "learning",
    },
    courseSlug: { type: String, default: null }, // Optional link to a dynamic Course (e.g. 'dsa', 'web-development')
    isTrackable: { type: Boolean, default: false }, // True for actionable habits/routines (gym, journaling)
    isProtected: { type: Boolean, default: false }, // Cannot be overwritten without confirmation
    notes: { type: String, default: "" },
  },
  { _id: false },
);

const scheduleTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  dayType: {
    type: String,
    enum: ["weekday", "saturday", "sunday", "holiday", "exam", "custom"],
    required: true,
  },
  title: { type: String, required: true },
  effectiveFrom: { type: String, default: "2026-01-01", index: true }, // "YYYY-MM-DD"
  version: { type: Number, default: 1 },
  blocks: [scheduleBlockSchema],
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

scheduleTemplateSchema.index({ userId: 1, dayType: 1, effectiveFrom: -1 });

export const ScheduleTemplate =
  mongoose.models.ScheduleTemplate ||
  mongoose.model("ScheduleTemplate", scheduleTemplateSchema);
