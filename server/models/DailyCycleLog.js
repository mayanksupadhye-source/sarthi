import mongoose from "mongoose";

const dailyCycleLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CycleProfile",
      required: true,
      index: true,
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    mood: {
      type: String,
      enum: [
        "happy",
        "calm",
        "energized",
        "neutral",
        "low",
        "frustrated",
        "anxious",
        "sad",
        "other",
      ],
      default: null,
    },
    energyLevel: { type: Number, min: 1, max: 5, default: null },
    painLevel: { type: Number, min: 0, max: 10, default: null },
    symptoms: [{ type: String, trim: true, maxlength: 60 }],
    notes: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true },
);

dailyCycleLogSchema.index({ profileId: 1, date: 1 }, { unique: true });
dailyCycleLogSchema.index({ userId: 1, profileId: 1, date: -1 });

export const DailyCycleLog =
  mongoose.models.DailyCycleLog ||
  mongoose.model("DailyCycleLog", dailyCycleLogSchema);
