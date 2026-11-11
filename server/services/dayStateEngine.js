import { DailyPlan } from '../models/DailyPlan.js';
import { Task } from '../models/Task.js';
import { FocusSession } from '../models/FocusSession.js';
import { Setting } from '../models/Setting.js';
import { ScheduleTemplate } from '../models/ScheduleTemplate.js';

/**
 * Computes the emotional and execution dayState for a user.
 * States:
 * - exam_mode: Exam active in settings
 * - rest_approved: Rest/recovery recorded intentionally
 * - low_energy: User tapped "Not at my best today"
 * - in_flow: Focus session running or completed in past 15 min
 * - returning: Returning after >= 1 day of no check-in
 * - disrupted: Disrupted day logged
 * - late_start: Current block started > 3 min ago with no session
 * - partial: Some P1 work banked, remaining work scheduled
 * - on_track: On pace with today's scheduled blocks
 * - fresh: Day not yet started
 */
export async function computeDayState(userId, dateString = null, currentTimeString = null) {
  const today = dateString || new Date().toISOString().split('T')[0];
  const nowTime = currentTimeString || new Date().toTimeString().substring(0, 5); // "HH:MM"

  // 1. Check Exam Mode
  const settings = await Setting.findOne({ userId }) || {};
  if (settings.examModeEnabled) {
    const start = settings.examModeStartDate;
    const end = settings.examModeEndDate;
    if ((!start || today >= start) && (!end || today <= end)) {
      return { dayState: 'exam_mode', reason: 'University examination mode active' };
    }
  }

  // 2. Check DailyPlan flags
  const dailyPlan = await DailyPlan.findOne({ userId, date: today });
  if (dailyPlan?.isRestApproved) {
    return { dayState: 'rest_approved', reason: 'Approved rest and recovery day' };
  }
  if (dailyPlan?.isLowEnergy) {
    return { dayState: 'low_energy', reason: 'Minimum day mode active' };
  }
  if (dailyPlan?.isDisrupted) {
    return { dayState: 'disrupted', reason: 'Unavoidable disruption recorded' };
  }

  // 3. Check In-Flow State (Active or recently completed focus session)
  const activeSession = await FocusSession.findOne({
    userId,
    status: { $in: ['active', 'paused'] }
  });
  if (activeSession) {
    return {
      dayState: 'in_flow',
      reason: 'Focus timer actively running',
      activeSessionTitle: activeSession.title
    };
  }

  // 4. Check Returning State (Gap of >= 1 day without check-in)
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayPlan = await DailyPlan.findOne({ userId, date: yesterday });
  const recentSessions = await FocusSession.countDocuments({
    userId,
    createdAt: { $gte: new Date(Date.now() - 48 * 3600000) }
  });

  if (!yesterdayPlan && recentSessions === 0 && (!dailyPlan || dailyPlan.tasks?.length === 0)) {
    return {
      dayState: 'returning',
      reason: 'Returning after gap. Ready for a clean, small entry.'
    };
  }

  // 5. Check Timetable Block & Late Start ("3 wasted minutes" problem)
  const dayOfWeek = new Date().getDay(); // 0 is Sunday, 6 is Saturday
  let dayType = 'weekday';
  if (dayOfWeek === 0) dayType = 'sunday';
  else if (dayOfWeek === 6) dayType = 'saturday';

  const template = await ScheduleTemplate.findOne({ userId, dayType, isActive: true });
  if (template?.blocks) {
    for (const block of template.blocks) {
      if (nowTime >= block.startTime && nowTime <= block.endTime) {
        // We are currently inside this block.
        // Convert block start time and nowTime to minutes
        const [startH, startM] = block.startTime.split(':').map(Number);
        const [nowH, nowM] = nowTime.split(':').map(Number);
        const startTotalM = startH * 60 + startM;
        const nowTotalM = nowH * 60 + nowM;
        const minutesLate = nowTotalM - startTotalM;

        const [endH, endM] = block.endTime.split(':').map(Number);
        const endTotalM = endH * 60 + endM;
        const minutesLeft = Math.max(0, endTotalM - nowTotalM);

        // Check if any focus session was logged for this block today
        const sessionInBlock = await FocusSession.findOne({
          userId,
          date: today,
          createdAt: { $gte: new Date(today + 'T' + block.startTime + ':00') }
        });

        if (minutesLate >= 3 && !sessionInBlock && minutesLeft > 10) {
          return {
            dayState: 'late_start',
            reason: `Block started ${minutesLate}m ago. ${minutesLeft}m remain.`,
            blockName: block.title,
            minutesLate,
            minutesLeft,
            sliceTitle: `10-minute starter slice for ${block.title}`
          };
        }
      }
    }
  }

  // 6. Check Task Progress (Partial vs On-Track vs Fresh)
  const todayTasks = await Task.find({
    userId,
    scheduledDate: today
  });

  if (todayTasks.length === 0) {
    return { dayState: 'fresh', reason: 'Day not started yet' };
  }

  const completedP1 = todayTasks.filter(t => t.priority === 'P1' && t.status === 'completed');
  const pendingP1 = todayTasks.filter(t => t.priority === 'P1' && t.status !== 'completed');

  if (completedP1.length > 0 && pendingP1.length > 0) {
    return {
      dayState: 'partial',
      reason: 'Some essentials banked, remaining slice ready',
      doneCount: completedP1.length,
      pendingCount: pendingP1.length
    };
  }

  if (completedP1.length > 0 && pendingP1.length === 0) {
    return {
      dayState: 'on_track',
      reason: 'All essential P1 targets completed for today'
    };
  }

  return { dayState: 'fresh', reason: 'Fresh start for today' };
}
