import mongoose from "mongoose";

const periodRecordSchema = new mongoose.Schema(
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
    actualPeriodStartDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    actualPeriodEndDate: {
      type: String,
      default: null,
      match: [/^\d{4}-\d{2}-\d{2}$/, "End date must use YYYY-MM-DD"],
    },
    recordedAt: { type: Date, default: Date.now },
    notes: { type: String, default: "", maxlength: 1000 },
    recordType: {
      type: String,
      enum: ["actual"],
      default: "actual",
      immutable: true,
    },
  },
  { timestamps: true },
);

periodRecordSchema.index(
  { profileId: 1, actualPeriodStartDate: 1 },
  { unique: true },
);
periodRecordSchema.index({
  userId: 1,
  profileId: 1,
  actualPeriodStartDate: -1,
});

export const PeriodRecord =
  mongoose.models.PeriodRecord ||
  mongoose.model("PeriodRecord", periodRecordSchema);
