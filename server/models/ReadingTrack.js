import mongoose from "mongoose";

const readingTrackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    phaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadingPhase",
      default: null,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    sequence: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

readingTrackSchema.index({ userId: 1, sequence: 1 }, { unique: true });
readingTrackSchema.index({ userId: 1, name: 1 }, { unique: true });
export const ReadingTrack =
  mongoose.models.ReadingTrack ||
  mongoose.model("ReadingTrack", readingTrackSchema);
