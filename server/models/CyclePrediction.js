import mongoose from "mongoose";

const cyclePredictionSchema = new mongoose.Schema(
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
      unique: true,
      index: true,
    },
    basedOnPeriodRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PeriodRecord",
      required: true,
    },
    estimatedCycleLengthDays: {
      type: Number,
      required: true,
      min: 15,
      max: 60,
    },
    predictedNextPeriodStart: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    currentCycleStart: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    phaseDates: [
      {
        key: { type: String, required: true },
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
      },
    ],
    ovulationWindow: { startDate: { type: String }, endDate: { type: String } },
    fertileWindow: { startDate: { type: String }, endDate: { type: String } },
    generatedForDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const CyclePrediction =
  mongoose.models.CyclePrediction ||
  mongoose.model("CyclePrediction", cyclePredictionSchema);
