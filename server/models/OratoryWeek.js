import mongoose from 'mongoose';

const oratoryWeekSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekNumber: { type: Number, required: true, min: 1, max: 13 },
  topic: { type: String, required: true },
  primarySkill: { type: String, required: true },
  description: { type: String, default: '' },
  speechDraft: {
    hook: { type: String, default: '' },
    introduction: { type: String, default: '' },
    point1: { type: String, default: '' },
    point2: { type: String, default: '' },
    point3: { type: String, default: '' },
    storyExample: { type: String, default: '' },
    conclusion: { type: String, default: '' }
  },
  scores: {
    structure: { type: Number, min: 1, max: 10, default: 5 },
    clarity: { type: Number, min: 1, max: 10, default: 5 },
    confidence: { type: Number, min: 1, max: 10, default: 5 },
    voice: { type: Number, min: 1, max: 10, default: 5 },
    gestures: { type: Number, min: 1, max: 10, default: 5 },
    persuasion: { type: Number, min: 1, max: 10, default: 5 }
  },
  biggestMistake: { type: String, default: '' },
  drillNotes: { type: String, default: '' },
  firstRecordingNotes: { type: String, default: '' },
  finalRecordingNotes: { type: String, default: '' },
  comparisonSummary: { type: String, default: '' },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

oratoryWeekSchema.index({ userId: 1, weekNumber: 1 }, { unique: true });

export const OratoryWeek = mongoose.models.OratoryWeek || mongoose.model('OratoryWeek', oratoryWeekSchema);
