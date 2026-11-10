import { Setting } from '../models/Setting.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { DailyPlan } from '../models/DailyPlan.js';
import { SlackDayLog } from '../models/SlackDayLog.js';
import { FocusSession } from '../models/FocusSession.js';
import { Course } from '../models/Course.js';
import { OratoryWeek } from '../models/OratoryWeek.js';
import { AcademicSubject } from '../models/AcademicSubject.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { Assignment } from '../models/Assignment.js';
import { Examination } from '../models/Examination.js';
import { Hackathon } from '../models/Hackathon.js';
import { FitnessLog } from '../models/FitnessLog.js';
import { WeightLog } from '../models/WeightLog.js';
import { Habit } from '../models/Habit.js';
import { HabitLog } from '../models/HabitLog.js';
import { Note } from '../models/Note.js';
import { ReadingLog } from '../models/ReadingLog.js';
import { MarketConcept } from '../models/MarketConcept.js';
import { Reward, SavingsEntry } from '../models/Reward.js';
import { config } from '../config/env.js';

export async function getSettings(req, res, next) {
  try {
    let settings = await Setting.findOne({ userId: req.user.id });
    if (!settings) {
      settings = await Setting.create({ userId: req.user.id });
    }
    return res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    delete updates.userId;

    const settings = await Setting.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true, upsert: true }
    );

    return res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

export async function exportAllUserData(req, res, next) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-passwordHash');
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
    const readingLogs = await ReadingLog.find({ userId });
    const marketConcepts = await MarketConcept.find({ userId });
    const rewards = await Reward.find({ userId });
    const savings = await SavingsEntry.find({ userId });

    const exportPayload = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      user,
      settings,
      data: {
        tasks,
        plans,
        slackDays,
        focusSessions,
        courses,
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
        marketConcepts,
        rewards,
        savings
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sarthi_backup_${new Date().toISOString().split('T')[0]}.json"`);
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
        status: Boolean(config.googleClientId) ? 'ready_to_connect' : 'credentials_not_configured',
        authUrl: config.googleClientId ? `/api/integrations/google/auth` : null,
        message: Boolean(config.googleClientId) 
          ? 'Google Calendar client credentials configured on server.' 
          : 'Optional integration. To enable, configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
      },
      webPush: {
        configured: Boolean(config.vapidPublicKey && config.vapidPrivateKey),
        status: Boolean(config.vapidPublicKey) ? 'ready' : 'credentials_not_configured',
        publicKey: config.vapidPublicKey || null,
        message: Boolean(config.vapidPublicKey)
          ? 'VAPID keys configured for browser notifications.'
          : 'Optional push notifications. Add VAPID keys to .env to enable web push.'
      }
    }
  });
}
