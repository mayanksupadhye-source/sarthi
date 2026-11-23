import mongoose from "mongoose";

const journalEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    journalDate: { type: Date, required: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    content: { type: String, required: true, trim: false, maxlength: 30000 },
    submissionKey: { type: String, maxlength: 128, default: undefined },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

journalEntrySchema.index({ userId: 1, dateKey: -1, createdAt: -1 });
journalEntrySchema.index(
  { userId: 1, submissionKey: 1 },
  {
    unique: true,
    partialFilterExpression: { submissionKey: { $type: "string" } },
  },
);

export const JournalEntry =
  mongoose.models.JournalEntry ||
  mongoose.model("JournalEntry", journalEntrySchema);
