import mongoose from "mongoose";

const hackathonNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hackathonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hackathon",
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    type: {
      type: String,
      enum: ["stage-start", "stage-deadline", "stage-end", "final-deadline"],
      required: true,
    },
    stageKey: { type: String, required: true },
    stageName: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    scheduledFor: { type: Date, required: true, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

hackathonNotificationSchema.index({ userId: 1, key: 1 }, { unique: true });
hackathonNotificationSchema.index({ userId: 1, scheduledFor: 1, readAt: 1 });

export const HackathonNotification =
  mongoose.models.HackathonNotification ||
  mongoose.model("HackathonNotification", hackathonNotificationSchema);
