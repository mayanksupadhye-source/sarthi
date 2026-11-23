import mongoose from "mongoose";

const readingLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReadingBook",
      default: null,
      index: true,
    },
    bookTitle: { type: String, required: true, trim: true },
    author: { type: String, default: "" },
    date: { type: String, required: true }, // YYYY-MM-DD
    startPage: { type: Number, default: 0 },
    endPage: { type: Number, default: 0 },
    pagesRead: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 35 },
    keyTakeaways: { type: String, default: "" },
    practicalApplication: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

readingLogSchema.index({ userId: 1, bookId: 1, date: -1, createdAt: -1 });

export const ReadingLog =
  mongoose.models.ReadingLog || mongoose.model("ReadingLog", readingLogSchema);
