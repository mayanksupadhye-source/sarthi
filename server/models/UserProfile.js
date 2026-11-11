import mongoose from 'mongoose';

const patternSchema = new mongoose.Schema({
  id: { type: String, required: true },
  description: { type: String, required: true },
  signals: [{ type: String }],
  interventions: [{ type: String }]
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  period: { type: String, default: '' },
  note: { type: String, default: '' },
  tags: [{ type: String }],
  autoAdded: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: Date.now }
});

const streakRecordSchema = new mongoose.Schema({
  label: { type: String, required: true },
  days: { type: Number, required: true },
  period: { type: String, default: '' },
  source: { type: String, default: 'self-reported' }
}, { _id: false });

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  challenge: {
    start: { type: String, default: '2026-11-16' },
    lastPlannedDay: { type: String, default: '2027-04-25' },
    milestoneDate: { type: String, default: '2027-04-26' },
    milestoneLabel: { type: String, default: '20th birthday' },
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  patterns: [patternSchema],
  strengths: [{ type: String }],
  evidence: [evidenceSchema],
  streakRecords: [streakRecordSchema],
  voice: {
    persona: { type: String, default: 'A calm, capable friend. Direct and specific. Never a drill sergeant, never a therapist.' },
    maxVisibleMessages: { type: Number, default: 1 },
    maxMessagesPerDay: { type: Number, default: 3 },
    maxWords: { type: Number, default: 18 },
    quietHours: {
      start: { type: String, default: '23:30' },
      end: { type: String, default: '05:00' }
    },
    language: { type: String, default: 'English' },
    allowUserAddedQuotes: { type: Boolean, default: true },
    forbiddenPhrases: [{ type: String }],
    forbiddenTopicsForAutoMessages: [{ type: String }],
    toneRules: [{ type: String }]
  },
  why: { type: String, default: '' },
  streakRules: {
    showUpRequires: { type: String, default: 'check-in AND at least one P1 action, OR an approved rest/low-energy day' },
    optionalTasksAffectStreak: { type: Boolean, default: false },
    slackDayProtectsStreak: { type: Boolean, default: true },
    tiers: {
      spark: [Number],
      steady: [Number],
      strong: [Number],
      roaring: [Number],
      blaze: [Number]
    },
    milestones: [{ type: Number }]
  },
  rewardPrefs: {
    interests: [{ type: String }],
    cycleLengthDays: [{ type: Number }],
    preferredSlot: { type: String, default: 'Sunday night' },
    movieNight: {
      enabled: { type: Boolean, default: true },
      suggestedCriteria: mongoose.Schema.Types.Mixed
    },
    monthlySweetTreat: {
      enabled: { type: Boolean, default: true },
      tiedTo: { type: String, default: 'no-sugar days in the month' }
    },
    finalReward: {
      label: { type: String, default: 'Mountain trek, solo or with friends' },
      savingsTargetINR: { type: Number, default: 4000 },
      monthlyContributionINR: { type: Number, default: 800 },
      note: { type: String, default: 'Contribution plan is editable' }
    },
    rule: { type: String, default: 'One imperfect day must never cancel a reward. Criteria are thresholds.' }
  },
  blockGuardRules: {
    protectedBlocks: [{ type: String }],
    behaviour: { type: String, default: 'Prompt (not block) when hackathon work starts inside a protected block. The user decides; record the choice.' }
  },
  hackathonRules: {
    defaultStages: [{ type: String }],
    weeklyHackathonBudgetHours: { type: Number, default: 6 },
    weeklyBudgetNote: { type: String, default: 'Suggested default only, edit in Settings' },
    afterResult: [{ type: String }],
    reminderLeadTimes: [{ type: String }]
  },
  fitness: {
    startWeightKg: { type: Number, default: 88 },
    targetWeightKg: { type: Number, default: 73 },
    checkInEveryDays: { type: Number, default: 14 },
    noSugarChallenge: { type: Boolean, default: true },
    note: { type: String, default: 'User-entered goal, not medical advice. Sick days are neutral.' }
  }
}, { timestamps: true });

export const UserProfile = mongoose.model('UserProfile', userProfileSchema);
