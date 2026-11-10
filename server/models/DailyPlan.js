import mongoose from 'mongoose';

const dailyPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  dayType: { type: String, default: 'weekday' },
  targetCapacityMinutes: { type: Number, default: 330 },
  allocatedMinutes: { type: Number, default: 0 },
  completedMinutes: { type: Number, default: 0 },
  tasks: [{
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    title: { type: String },
    priority: { type: String, enum: ['P1', 'P2', 'P3'] },
    estimatedMinutes: { type: Number },
    remainingMinutes: { type: Number },
    actualMinutes: { type: Number, default: 0 },
    status: { type: String, default: 'pending' },
    isProtected: { type: Boolean, default: false }
  }],
  isSlackDay: { type: Boolean, default: false },
  slackDayReason: { type: String, default: '' },
  status: { type: String, enum: ['planned', 'active', 'recalculated', 'closed'], default: 'planned' },
  replanCount: { type: Number, default: 0 },
  replanHistory: [{
    timestamp: { type: Date, default: Date.now },
    reason: { type: String },
    proposalSummary: { type: String },
    tasksModified: { type: Number }
  }],
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

dailyPlanSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyPlan = mongoose.models.DailyPlan || mongoose.model('DailyPlan', dailyPlanSchema);
