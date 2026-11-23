import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  timezone: { type: String, default: "Asia/Kolkata" },
  startingWeightKg: { type: Number, default: 90 },
  targetWeightKg: { type: Number, default: 73 },
  sleepWindowStart: { type: String, default: "23:40" },
  sleepWindowEnd: { type: String, default: "05:00" },
  protectedSleepMinutes: { type: Number, default: 320 },
  monthlySlackDayAllowance: { type: Number, default: 3 },
  monthlySlackDaysAllowed: { type: Number, default: 3 },
  dailyMaxWorkMinutes: { type: Number, default: 480 }, // 8 hours max realistic daily workload
  defaultPracticeMultiplier: { type: Number, default: 2.0 }, // Universal 2x learning effort rule
  examModeEnabled: { type: Boolean, default: false },
  examModeStartDate: { type: Date },
  examModeEndDate: { type: Date },
  examModeFocusSubjects: [{ type: String }],
  examPreparationAllowanceSemester: { type: Number, default: 15 },
  examPreparationMaxPerMonth: { type: Number, default: 7 },
  notificationsEnabled: { type: Boolean, default: true },
  emailDigestEnabled: { type: Boolean, default: false },
  noSugarChallengeEnabled: { type: Boolean, default: true },
  personalHeadline: { type: String, default: "", trim: true, maxlength: 160 },
  savingsTargetAmount: { type: Number, default: 5000 },
  weightCheckInSequence: { type: Number, default: 0, min: 0 },
  updatedAt: { type: Date, default: Date.now },
});

export const Setting =
  mongoose.models.Setting || mongoose.model("Setting", settingSchema);
