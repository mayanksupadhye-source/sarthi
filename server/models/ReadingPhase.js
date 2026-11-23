import mongoose from "mongoose";

const readingPhaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 1200 },
    category: { type: String, default: "", trim: true, maxlength: 80 },
    sequence: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);

readingPhaseSchema.index({ userId: 1, sequence: 1 }, { unique: true });
export const ReadingPhase =
  mongoose.models.ReadingPhase ||
  mongoose.model("ReadingPhase", readingPhaseSchema);
