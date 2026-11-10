import mongoose from 'mongoose';

const habitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    enum: ['routine', 'fitness', 'night-routine', 'mindset', 'no-sugar', 'learning'], 
    default: 'routine' 
  },
  timeOfDay: { type: String, enum: ['morning', 'afternoon', 'evening', 'night', 'anytime'], default: 'anytime' },
  frequency: { type: String, enum: ['daily', 'weekdays', 'weekends', 'custom'], default: 'daily' },
  targetPerWeek: { type: Number, default: 7 },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const Habit = mongoose.models.Habit || mongoose.model('Habit', habitSchema);
