import mongoose from "mongoose";

const scheduleExceptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
  exceptionType: {
    type: String,
    enum: [
      "college_holiday",
      "exam_leave",
      "cancelled_lecture",
      "custom_free",
      "extra_classes",
    ],
    default: "college_holiday",
  },
  templateOverride: {
    type: String,
    enum: ["weekday", "saturday", "sunday", "holiday", "exam", "custom"],
    default: "holiday",
  },
  extraAvailableMinutes: { type: Number, default: 0 },
  customBlocks: [
    {
      blockId: { type: String, required: true },
      label: { type: String, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
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
      isProtected: { type: Boolean, default: false },
      notes: { type: String, default: "" },
    },
  ],
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

scheduleExceptionSchema.index({ userId: 1, date: 1 }, { unique: true });

export const ScheduleException =
  mongoose.models.ScheduleException ||
  mongoose.model("ScheduleException", scheduleExceptionSchema);
