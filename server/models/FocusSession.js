import mongoose from 'mongoose';

const pauseIntervalSchema = new mongoose.Schema({
  pausedAt: { type: Date, required: true },
  resumedAt: { type: Date }
}, { _id: false });

const focusSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, default: 'general' },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  courseSlug: { type: String }, // 'web-dev' or 'dsa' or 'oratory'
  lectureId: { type: String },
  targetMinutes: { type: Number, default: 25 },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'completed', 'cancelled'], 
    default: 'active',
    index: true 
  },
  pauses: [pauseIntervalSchema],
  actualMinutes: { type: Number, default: 0 },
  interruptionsCount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

focusSessionSchema.methods.calculateActualDuration = function() {
  const end = this.endTime || new Date();
  let totalMs = end.getTime() - this.startTime.getTime();

  for (const p of this.pauses) {
    if (p.pausedAt) {
      const resume = p.resumedAt || (this.status === 'paused' ? new Date() : p.pausedAt);
      totalMs -= (resume.getTime() - p.pausedAt.getTime());
    }
  }

  const durationMin = Math.max(0, Math.round(totalMs / 60000));
  this.actualMinutes = durationMin;
  return durationMin;
};

export const FocusSession = mongoose.models.FocusSession || mongoose.model('FocusSession', focusSessionSchema);
