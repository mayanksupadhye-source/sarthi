import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { Task } from '../models/Task.js';
import { FocusSession } from '../models/FocusSession.js';
import { AcademicSubject } from '../models/AcademicSubject.js';
import { Setting } from '../models/Setting.js';
import { WeightLog } from '../models/WeightLog.js';
import { SlackDayLog } from '../models/SlackDayLog.js';
import { Habit } from '../models/Habit.js';
import { HabitLog } from '../models/HabitLog.js';

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/insights/summary
 * Transparent, deterministic insights based on user activity:
 * 1. Attendance risk alerts (< 75%)
 * 2. Over-capacity / backlog overload warnings
 * 3. Focus momentum
 * 4. Weight tracking progress
 * 5. Slack day buffer status
 */
router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // 1. Attendance check
    const subjects = await AcademicSubject.find({ userId });
    const attendanceAlerts = [];
    for (const sub of subjects) {
      const total = sub.conductedHours || 0;
      const attended = sub.attendedHours || 0;
      const pct = total > 0 ? (attended / total) * 100 : 100;
      if (pct < 75 && total > 0) {
        const needed = Math.ceil((0.75 * total - attended) / 0.25);
        attendanceAlerts.push({
          subject: sub.name,
          percentage: Math.round(pct * 10) / 10,
          classesNeeded: Math.max(1, needed),
          severity: pct < 65 ? 'critical' : 'warning'
        });
      }
    }

    // 2. Task Backlog & Overload check
    const pendingTasks = await Task.find({ userId, status: { $in: ['pending', 'in-progress'] } });
    const p1Tasks = pendingTasks.filter(t => t.priority === 'P1');
    const totalBacklogMinutes = pendingTasks.reduce((sum, t) => sum + (t.remainingMinutes || t.estimatedMinutes || 0), 0);
    const settings = await Setting.findOne({ userId }) || { dailyMaxWorkMinutes: 480 };
    const maxCapacity = settings.dailyMaxWorkMinutes || 480;

    const backlogDaysEquivalent = maxCapacity > 0 ? (totalBacklogMinutes / maxCapacity).toFixed(1) : 0;

    // 3. Focus Sessions stats
    const focusSessions = await FocusSession.find({ userId, status: 'completed' });
    const totalFocusMinutes = focusSessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);

    // 4. Slack Day buffer
    const currentMonth = today.substring(0, 7);
    const monthlySlackDays = await SlackDayLog.countDocuments({
      userId,
      date: { $regex: `^${currentMonth}` }
    });
    const slackAllowed = settings.monthlySlackDaysAllowed || 2;
    const slackRemaining = Math.max(0, slackAllowed - monthlySlackDays);

    // 5. Weight Progress
    const weightLogs = await WeightLog.find({ userId }).sort({ date: 1 });
    const startWeight = settings.startingWeightKg || 88;
    const targetWeight = settings.targetWeightKg || 73;
    const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : startWeight;
    const weightLost = Math.max(0, startWeight - currentWeight);

    // 6. Habit Check-in rate (last 7 days)
    const activeHabits = await Habit.find({ userId, isActive: true });

    // Generate explainable observations
    const observations = [];

    if (attendanceAlerts.length > 0) {
      observations.push({
        type: 'danger',
        category: 'Attendance Risk',
        title: `${attendanceAlerts.length} subject(s) below mandatory 75% threshold`,
        detail: attendanceAlerts.map(a => `${a.subject}: ${a.percentage}% (${a.classesNeeded} consecutive classes required to reach 75%)`).join('; ')
      });
    }

    if (totalBacklogMinutes > maxCapacity * 2) {
      observations.push({
        type: 'warning',
        category: 'Capacity Risk',
        title: `Backlog exceeds 2 days of maximum work capacity (${Math.round(totalBacklogMinutes / 60)}h total)`,
        detail: 'Consider using the Adaptive Planner to defer lower-priority (P3) tasks or reduce daily scope rather than accumulating unbounded backlog.'
      });
    }

    if (slackRemaining === 0) {
      observations.push({
        type: 'warning',
        category: 'Buffer Exhaustion',
        title: `All monthly Slack Days used for ${currentMonth}`,
        detail: 'Disruptions will now require distributing catch-up across available execution blocks rather than triggering a full buffer day.'
      });
    }

    if (totalFocusMinutes > 0) {
      observations.push({
        type: 'success',
        category: 'Focus Momentum',
        title: `${Math.round(totalFocusMinutes / 60)} hours logged in deep focus`,
        detail: `${focusSessions.length} focus sessions completed across tracked modules.`
      });
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        totalFocusMinutes,
        totalFocusHours: (totalFocusMinutes / 60).toFixed(1),
        focusSessionsCount: focusSessions.length,
        pendingTasksCount: pendingTasks.length,
        p1TasksCount: p1Tasks.length,
        totalBacklogMinutes,
        backlogDaysEquivalent: Number(backlogDaysEquivalent),
        attendanceAlertsCount: attendanceAlerts.length,
        slackDaysUsed: monthlySlackDays,
        slackDaysRemaining: slackRemaining,
        currentWeightKg: currentWeight,
        weightLostKg: Math.round(weightLost * 10) / 10,
        activeHabitsCount: activeHabits.length
      },
      attendanceAlerts,
      observations
    });
  } catch (err) {
    next(err);
  }
});

export default router;
