import mongoose from 'mongoose';

const readingLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bookTitle: { type: String, required: true, trim: true },
  author: { type: String, default: '' },
  date: { type: String, required: true }, // YYYY-MM-DD
  startPage: { type: Number, default: 0 },
  endPage: { type: Number, default: 0 },
  pagesRead: { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 35 },
  keyTakeaways: { type: String, default: '' },
  practicalApplication: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const ReadingLog = mongoose.models.ReadingLog || mongoose.model('ReadingLog', readingLogSchema);
