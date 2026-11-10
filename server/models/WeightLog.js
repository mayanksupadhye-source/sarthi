import mongoose from 'mongoose';

const weightLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  weightKg: { type: Number, required: true, min: 30, max: 200 },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

weightLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const WeightLog = mongoose.models.WeightLog || mongoose.model('WeightLog', weightLogSchema);
