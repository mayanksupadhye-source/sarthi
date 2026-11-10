import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sets: { type: Number, default: 3 },
  reps: { type: Number, default: 10 },
  weightKg: { type: Number, default: 0 },
  notes: { type: String, default: '' }
}, { _id: false });

const fitnessLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  workoutType: { 
    type: String, 
    enum: ['push', 'pull', 'legs', 'upper', 'lower', 'cardio', 'core', 'rest'], 
    required: true 
  },
  durationMinutes: { type: Number, default: 60 },
  exercises: [exerciseSchema],
  energyLevel: { type: Number, min: 1, max: 5, default: 3 },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const FitnessLog = mongoose.models.FitnessLog || mongoose.model('FitnessLog', fitnessLogSchema);
