import { Setting } from "../models/Setting.js";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { DailyPlan } from "../models/DailyPlan.js";
import { SlackDayLog } from "../models/SlackDayLog.js";
import { FocusSession } from "../models/FocusSession.js";
import { Course } from "../models/Course.js";
import { OratoryWeek } from "../models/OratoryWeek.js";
import { AcademicSubject } from "../models/AcademicSubject.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Assignment } from "../models/Assignment.js";
import { Examination } from "../models/Examination.js";
import { Hackathon } from "../models/Hackathon.js";
import { FitnessLog } from "../models/FitnessLog.js";
import { WeightLog } from "../models/WeightLog.js";
import { Habit } from "../models/Habit.js";
import { HabitLog } from "../models/HabitLog.js";
import { Note } from "../models/Note.js";
import { ReadingLog } from "../models/ReadingLog.js";
import { MarketConcept } from "../models/MarketConcept.js";
import { Reward, SavingsEntry } from "../models/Reward.js";
import { SavingsAccount } from "../models/SavingsAccount.js";
import { SavingsDeposit } from "../models/SavingsDeposit.js";
import { JournalEntry } from "../models/JournalEntry.js";
import { ReadingPhase } from "../models/ReadingPhase.js";
import { ReadingTrack } from "../models/ReadingTrack.js";
import { ReadingBook } from "../models/ReadingBook.js";
import { CyclePrediction } from "../models/CyclePrediction.js";
import { CycleProfile } from "../models/CycleProfile.js";
import { DailyCycleLog } from "../models/DailyCycleLog.js";
import { PeriodRecord } from "../models/PeriodRecord.js";
import { RecoveryLedger } from "../models/RecoveryLedger.js";
import { ScheduleException } from "../models/ScheduleException.js";
import { ScheduleTemplate } from "../models/ScheduleTemplate.js";
import { UserProfile } from "../models/UserProfile.js";
import { HackathonNotification } from "../models/HackathonNotification.js";
import { AllocationService } from "../services/allocationService.js";
import { getTodayString } from "../utils/timeFormat.js";
import { config } from "../config/env.js";

export async function getSettings(req, res, next) {
  try {
    let settings = await Setting.findOne({ userId: req.user.id });
    if (!settings) {
      settings = await Setting.create({ userId: req.user.id });
    }
    if (
      settings.monthlySlackDayAllowance !== 3 ||
      settings.monthlySlackDaysAllowed !== 3
    ) {
      settings.monthlySlackDayAllowance = 3;
      settings.monthlySlackDaysAllowed = 3;
    }
    if (settings.startingWeightKg === 88) settings.startingWeightKg = 90;
    if (settings.targetWeightKg !== 73) settings.targetWeightKg = 73;
    if (settings.savingsTargetAmount === 4000)
      settings.savingsTargetAmount = 5000;
    if (settings.isModified()) await settings.save();
    return res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    delete updates.userId;
    if (updates.personalHeadline !== undefined) {
      if (
        typeof updates.personalHeadline !== "string" ||
        updates.personalHeadline.length > 160
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Personal headline must be 160 characters or fewer.",
          });
      }
      updates.personalHeadline = updates.personalHeadline.trim();
    }
    updates.startingWeightKg = 90;
    updates.targetWeightKg = 73;
    updates.savingsTargetAmount = 5000;
    updates.monthlySlackDayAllowance = 3;
    updates.monthlySlackDaysAllowed = 3;

    const settings = await Setting.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true, upsert: true },
    );

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (e) {
      console.warn("[updateSettings] Replan notice:", e.message);
    }

    return res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

export async function exportAllUserData(req, res, next) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select(
      "-passwordHash -refreshToken -refreshTokens -resetPasswordToken -emailVerificationToken",
    );
    const settings = await Setting.findOne({ userId });
    const tasks = await Task.find({ userId });
    const plans = await DailyPlan.find({ userId });
    const slackDays = await SlackDayLog.find({ userId });
    const focusSessions = await FocusSession.find({ userId });
    const courses = await Course.find({ userId });
    const oratoryWeeks = await OratoryWeek.find({ userId });
    const academicSubjects = await AcademicSubject.find({ userId });
    const attendanceRecords = await AttendanceRecord.find({ userId });
    const assignments = await Assignment.find({ userId });
    const examinations = await Examination.find({ userId });
    const hackathons = await Hackathon.find({ userId });
    const fitnessLogs = await FitnessLog.find({ userId });
    const weightLogs = await WeightLog.find({ userId });
    const habits = await Habit.find({ userId });
    const habitLogs = await HabitLog.find({ userId });
    const notes = await Note.find({ userId });
    const journalEntries = await JournalEntry.find({ userId }).sort({
      journalDate: -1,
      createdAt: -1,
    });
    const readingLogs = await ReadingLog.find({ userId });
    const readingPhases = await ReadingPhase.find({ userId }).sort({
      sequence: 1,
    });
    const readingTracks = await ReadingTrack.find({ userId }).sort({
      sequence: 1,
    });
    const readingBooks = await ReadingBook.find({ userId }).sort({
      sequence: 1,
    });
    const marketConcepts = await MarketConcept.find({ userId });
    const rewards = await Reward.find({ userId });
    const savings = await SavingsEntry.find({ userId });
    const savingsAccounts = await SavingsAccount.find({ userId });
    const savingsDeposits = await SavingsDeposit.find({ userId }).sort({
      serialNumber: 1,
    });
    const cyclePredictions = await CyclePrediction.find({ userId });
    const cycleProfiles = await CycleProfile.find({ userId });
    const dailyCycleLogs = await DailyCycleLog.find({ userId });
    const periodRecords = await PeriodRecord.find({ userId });
    const recoveryLedger = await RecoveryLedger.find({ userId });
    const scheduleExceptions = await ScheduleException.find({ userId });
    const scheduleTemplates = await ScheduleTemplate.find({ userId });
    const userProfile = await UserProfile.findOne({ userId });
    const hackathonNotifications = await HackathonNotification.find({ userId });
    const curriculumActivities = await (
      await import("../models/CurriculumActivity.js")
    ).CurriculumActivity.find({ userId });
    const executionRecords = await (
      await import("../models/ExecutionRecord.js")
    ).ExecutionRecord.find({ userId });

    const exportPayload = {
      exportVersion: "2.0",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      user,
      settings,
      data: {
        tasks,
        plans,
        slackDays,
        focusSessions,
        courses,
        curriculumActivities,
        executionRecords,
        oratoryWeeks,
        academicSubjects,
        attendanceRecords,
        assignments,
        examinations,
        hackathons,
        fitnessLogs,
        weightLogs,
        habits,
        habitLogs,
        notes,
        readingLogs,
        journalEntries,
        readingPhases,
        readingTracks,
        readingBooks,
        marketConcepts,
        rewards,
        savings,
        savingsAccounts,
        savingsDeposits,
        cyclePredictions,
        cycleProfiles,
        dailyCycleLogs,
        periodRecords,
        recoveryLedger,
        scheduleExceptions,
        scheduleTemplates,
        userProfile,
        hackathonNotifications,
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sarthi_backup_${new Date().toISOString().split("T")[0]}.json"`,
    );
    return res.json(exportPayload);
  } catch (err) {
    next(err);
  }
}

export async function getIntegrationStatus(req, res) {
  return res.json({
    success: true,
    integrations: {
      googleCalendar: {
        configured: Boolean(config.googleClientId && config.googleClientSecret),
        status: Boolean(config.googleClientId)
          ? "ready_to_connect"
          : "credentials_not_configured",
        authUrl: config.googleClientId ? `/api/integrations/google/auth` : null,
        message: Boolean(config.googleClientId)
          ? "Google Calendar client credentials configured on server."
          : "Optional integration. To enable, configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
      },
      webPush: {
        configured: Boolean(config.vapidPublicKey && config.vapidPrivateKey),
        status: Boolean(config.vapidPublicKey)
          ? "ready"
          : "credentials_not_configured",
        publicKey: config.vapidPublicKey || null,
        message: Boolean(config.vapidPublicKey)
          ? "VAPID keys configured for browser notifications."
          : "Optional push notifications. Add VAPID keys to .env to enable web push.",
      },
    },
  });
}
