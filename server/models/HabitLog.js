import mongoose from 'mongoose';

const habitLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  completed: { type: Boolean, default: true },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

habitLogSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });

export const HabitLog = mongoose.models.HabitLog || mongoose.model('HabitLog', habitLogSchema);
