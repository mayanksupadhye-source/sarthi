import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  priority: { type: String, enum: ['P1', 'P2', 'P3'], default: 'P2', index: true },
  status: { 
    type: String, 
    enum: ['pending', 'in-progress', 'completed', 'deferred', 'cancelled'], 
    default: 'pending',
    index: true 
  },
  category: { 
    type: String, 
    enum: ['academic', 'webdev', 'dsa', 'oratory', 'fitness', 'personal', 'hackathon', 'reading', 'general'], 
    default: 'general',
    index: true 
  },
  estimatedMinutes: { type: Number, required: true, min: 5, default: 30 },
  actualMinutes: { type: Number, default: 0, min: 0 },
  remainingMinutes: { type: Number, default: 30, min: 0 },
  scheduledDate: { type: String, index: true }, // Format: YYYY-MM-DD
  deadline: { type: String }, // Format: YYYY-MM-DD
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  isProtected: { type: Boolean, default: false },
  isDeferred: { type: Boolean, default: false },
  deferReason: { type: String, default: '' },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

taskSchema.pre('save', function(next) {
  if (this.isModified('estimatedMinutes') || this.isModified('actualMinutes')) {
    if (this.status === 'completed') {
      this.remainingMinutes = 0;
    } else {
      this.remainingMinutes = Math.max(0, this.estimatedMinutes - (this.actualMinutes || 0));
    }
  }
  this.updatedAt = new Date();
  if (typeof next === 'function') next();
});

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
