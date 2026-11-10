import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  startingWeightKg: { type: Number, default: 88 },
  targetWeightKg: { type: Number, default: 73 },
  sleepWindowStart: { type: String, default: '23:40' },
  sleepWindowEnd: { type: String, default: '05:00' },
  protectedSleepMinutes: { type: Number, default: 320 },
  monthlySlackDayAllowance: { type: Number, default: 4 },
  monthlySlackDaysAllowed: { type: Number, default: 2 },
  dailyMaxWorkMinutes: { type: Number, default: 480 }, // 8 hours max realistic daily workload
  examModeEnabled: { type: Boolean, default: false },
  examModeStartDate: { type: Date },
  examModeEndDate: { type: Date },
  examModeFocusSubjects: [{ type: String }],
  notificationsEnabled: { type: Boolean, default: true },
  emailDigestEnabled: { type: Boolean, default: false },
  noSugarChallengeEnabled: { type: Boolean, default: true },
  savingsTargetAmount: { type: Number, default: 4000 },
  updatedAt: { type: Date, default: Date.now }
});

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
