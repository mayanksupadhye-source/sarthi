import mongoose from 'mongoose';

const slackDayLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  monthKey: { type: String, required: true, index: true }, // "YYYY-MM"
  reason: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    enum: ['unavoidable_disruption', 'intentional_rest', 'exam_prep', 'illness', 'family'],
    default: 'unavoidable_disruption'
  },
  tasksDeferredCount: { type: Number, default: 0 },
  deferredTaskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  replanApplied: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const SlackDayLog = mongoose.models.SlackDayLog || mongoose.model('SlackDayLog', slackDayLogSchema);
