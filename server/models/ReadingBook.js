import mongoose from "mongoose";

const readingBookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    author: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 2400 },
    category: { type: String, default: "", trim: true, maxlength: 80 },
    phaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadingPhase",
      default: null,
      index: true,
    },
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadingTrack",
      default: null,
      index: true,
    },
    sequence: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: [
        "upcoming",
        "available",
        "reading",
        "completed",
        "paused",
        "archived",
      ],
      default: "upcoming",
      index: true,
    },
    totalPages: { type: Number, default: null, min: 1 },
    currentPage: { type: Number, default: 0, min: 0 },
    pagesRead: { type: Number, default: 0, min: 0 },
    readingProgress: { type: Number, default: 0, min: 0, max: 100 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastReadAt: { type: Date, default: null },
    coverImage: { type: String, default: "", trim: true, maxlength: 1000 },
    archivedAt: { type: Date, default: null },
    isLegacy: { type: Boolean, default: false },
  },
  { timestamps: true },
);

readingBookSchema.index(
  { userId: 1, phaseId: 1, trackId: 1, sequence: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phaseId: { $type: "objectId" },
      trackId: { $type: "objectId" },
    },
  },
);
readingBookSchema.index({ userId: 1, title: 1, author: 1 });
export const ReadingBook =
  mongoose.models.ReadingBook ||
  mongoose.model("ReadingBook", readingBookSchema);
