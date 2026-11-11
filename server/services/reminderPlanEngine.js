/**
 * SARTHI — Reminder Plan Engine
 * Computes deterministic, scheduled reminder items across a 7-14 day rolling window.
 * Single source of truth for device notification scheduling.
 */

import { ScheduleTemplate } from '../models/ScheduleTemplate.js';
import { Task } from '../models/Task.js';
import { Hackathon } from '../models/Hackathon.js';
import { Examination } from '../models/Examination.js';
import { Reward } from '../models/Reward.js';
import { Setting } from '../models/Setting.js';
import { UserProfile } from '../models/UserProfile.js';
import { formatTime12 } from '../utils/timeFormat.js';

/**
 * Deterministic 32-bit integer hash from string key.
 * Android LocalNotifications require positive 32-bit integers.
 */
export function hashKeyToId(key) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const id = Math.abs(hash % 2147483647);
  return id === 0 ? 1 : id;
}

/**
 * Checks whether time "HH:mm" falls inside quiet hours.
 */
export function isQuietTime(timeStr, quietStart = '23:30', quietEnd = '05:00') {
  if (!timeStr) return false;
  if (quietStart > quietEnd) {
    // Overnight: e.g. 23:30 to 05:00
    return timeStr >= quietStart || timeStr <= quietEnd;
  }
  return timeStr >= quietStart && timeStr <= quietEnd;
}

/**
 * Converts a YYYY-MM-DD and HH:mm in Asia/Kolkata (+05:30) to UTC ISO string.
 */
export function kolkataToISO(dateStr, timeStr) {
  const paddedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${paddedTime}.000+05:30`).toISOString();
}

/**
 * Generates an array of YYYY-MM-DD date strings between fromDate and toDate (inclusive).
 */
export function getDateRange(fromStr, toStr) {
  const dates = [];
  const curr = new Date(`${fromStr}T00:00:00.000Z`);
  const end = new Date(`${toStr}T00:00:00.000Z`);

  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Generates the full reminder plan for a user within a date window.
 * 
 * @param {Object} options
 * @param {string} options.userId
 * @param {string} [options.from] - YYYY-MM-DD
 * @param {string} [options.to] - YYYY-MM-DD
 * @param {Date} [options.now] - Current reference time for past filtering
 * @returns {Promise<Array>} List of reminder objects
 */
export async function generateReminderPlan({
  userId,
  from,
  to,
  now = new Date()
}) {
  const timezone = 'Asia/Kolkata';

  // Read user settings & profile for quiet hours and notification preferences
  const [setting, userProfile] = await Promise.all([
    Setting.findOne({ userId }).lean().catch(() => null),
    UserProfile.findOne({ userId }).lean().catch(() => null)
  ]);

  if (setting && setting.notificationsEnabled === false) {
    return [];
  }

  const quietStart = userProfile?.voice?.quietHours?.start || setting?.sleepWindowStart || '23:30';
  const quietEnd = userProfile?.voice?.quietHours?.end || setting?.sleepWindowEnd || '05:00';

  // Default window: today through next 14 days in Asia/Kolkata
  const todayKolkata = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  const fromDate = from || todayKolkata;
  let toDate = to;
  if (!toDate) {
    const end = new Date(`${fromDate}T00:00:00.000+05:30`);
    end.setDate(end.getDate() + 14);
    toDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(end);
  }

  const dateList = getDateRange(fromDate, toDate);
  const reminders = [];

  // 1. Daily Check-in Briefings (Morning & Evening)
  for (const dateStr of dateList) {
    // Morning briefing at 07:00
    if (!isQuietTime('07:00', quietStart, quietEnd)) {
      const at = kolkataToISO(dateStr, '07:00');
      const key = `checkin-morning-${dateStr}`;
      reminders.push({
        id: hashKeyToId(key),
        key,
        at,
        title: 'Morning Briefing',
        body: 'Review today\'s high-priority tasks and focus commitments.',
        route: 'pages/dashboard.html',
        channel: 'checkin',
        kind: 'checkin'
      });
    }

    // Evening review at 21:30
    if (!isQuietTime('21:30', quietStart, quietEnd)) {
      const at = kolkataToISO(dateStr, '21:30');
      const key = `checkin-evening-${dateStr}`;
      reminders.push({
        id: hashKeyToId(key),
        key,
        at,
        title: 'Evening Review',
        body: 'Log today\'s completed work, check your streak, and close the day.',
        route: 'pages/dashboard.html',
        channel: 'checkin',
        kind: 'checkin'
      });
    }
  }

  // 2. Timetable Blocks (Templates)
  const templates = await ScheduleTemplate.find({ userId }).lean().catch(() => []);
  if (templates && templates.length > 0) {
    for (const dateStr of dateList) {
      const d = new Date(`${dateStr}T12:00:00.000+05:30`);
      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
      const dayType = dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : 'weekday';

      const template = templates.find(t => t.dayType === dayType) || templates.find(t => t.isDefault) || templates[0];
      if (template && Array.isArray(template.blocks)) {
        for (const block of template.blocks) {
          // Skip general rest or flexible blocks
          if (['rest', 'flexible'].includes(block.category)) continue;

          // Compute lead time: 10 minutes prior to block start
          const [hStr, mStr] = block.startTime.split(':');
          let h = parseInt(hStr, 10);
          let m = parseInt(mStr, 10) - 10;
          if (m < 0) {
            m += 60;
            h -= 1;
          }
          if (h < 0) h = 0;
          const leadTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

          if (isQuietTime(leadTimeStr, quietStart, quietEnd)) continue;

          const at = kolkataToISO(dateStr, leadTimeStr);
          const key = `timetable-${dateStr}-${block.startTime}-${(block.label || 'block').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          reminders.push({
            id: hashKeyToId(key),
            key,
            at,
            title: `Upcoming: ${block.label}`,
            body: `Scheduled ${block.durationMinutes}m block starting at ${formatTime12(block.startTime)}.`,
            route: 'pages/timetable.html',
            channel: 'focus',
            kind: 'timetable'
          });
        }
      }
    }
  }

  // 3. Essential P1 Tasks
  const p1Tasks = await Task.find({
    userId,
    priority: 'P1',
    status: { $ne: 'completed' },
    $or: [
      { scheduledDate: { $in: dateList } },
      { deadline: { $in: dateList } }
    ]
  }).lean().catch(() => []);

  for (const task of p1Tasks) {
    const taskDate = task.scheduledDate || task.deadline;
    if (!taskDate) continue;

    if (!isQuietTime('10:00', quietStart, quietEnd)) {
      const at = kolkataToISO(taskDate, '10:00');
      const key = `task-p1-${task._id.toString()}-${taskDate}`;
      reminders.push({
        id: hashKeyToId(key),
        key,
        at,
        title: `P1 Essential: ${task.title}`,
        body: `High-priority commitment: ${task.remainingMinutes || task.estimatedMinutes}m remaining.`,
        route: 'pages/tasks.html',
        channel: 'deadlines',
        kind: 'focus'
      });
    }
  }

  // 4. Hackathon Stages
  const hackathons = await Hackathon.find({ userId }).lean().catch(() => []);
  for (const hack of hackathons) {
    if (Array.isArray(hack.stages)) {
      for (const stage of hack.stages) {
        if (stage.status !== 'completed' && stage.deadline && dateList.includes(stage.deadline)) {
          if (!isQuietTime('11:00', quietStart, quietEnd)) {
            const at = kolkataToISO(stage.deadline, '11:00');
            const key = `hackathon-${hack._id.toString()}-${(stage.name || 'stage').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${stage.deadline}`;
            reminders.push({
              id: hashKeyToId(key),
              key,
              at,
              title: `Hackathon Milestone: ${stage.name}`,
              body: `${hack.title} stage deliverable due today: ${stage.deliverable || stage.name}.`,
              route: 'pages/hackathons.html',
              channel: 'deadlines',
              kind: 'deadline'
            });
          }
        }
      }
    }
  }

  // 5. Examinations
  const exams = await Examination.find({
    userId,
    examDate: { $in: dateList }
  }).lean().catch(() => []);

  for (const exam of exams) {
    const examTime = exam.startTime || '10:00';
    const [ehStr, emStr] = examTime.split(':');
    let eh = parseInt(ehStr, 10) - 1; // 1 hour lead time
    if (eh < 0) eh = 0;
    const leadExamTime = `${String(eh).padStart(2, '0')}:${emStr || '00'}`;

    if (!isQuietTime(leadExamTime, quietStart, quietEnd)) {
      const at = kolkataToISO(exam.examDate, leadExamTime);
      const key = `exam-${exam._id.toString()}-${exam.examDate}`;
      reminders.push({
        id: hashKeyToId(key),
        key,
        at,
        title: `Exam Alert: ${exam.subjectName}`,
        body: `${exam.examType.toUpperCase()} exam begins at ${formatTime12(examTime)}.`,
        route: 'pages/academics.html',
        channel: 'deadlines',
        kind: 'exam'
      });
    }
  }

  // 6. Unlocked Rewards Ready to Redeem
  const unlockedRewards = await Reward.find({
    userId,
    isUnlocked: true,
    isRedeemed: false
  }).lean().catch(() => []);

  if (unlockedRewards.length > 0 && dateList.length > 0) {
    const targetDate = dateList[0]; // Schedule on current day of plan
    if (!isQuietTime('20:00', quietStart, quietEnd)) {
      const at = kolkataToISO(targetDate, '20:00');
      for (const reward of unlockedRewards.slice(0, 2)) {
        const key = `reward-${reward._id.toString()}-${targetDate}`;
        reminders.push({
          id: hashKeyToId(key),
          key,
          at,
          title: 'Reward Unlocked!',
          body: `You unlocked "${reward.title}". Take time to celebrate your progress.`,
          route: 'pages/rewards.html',
          channel: 'rewards',
          kind: 'reward'
        });
      }
    }
  }

  // Filter out any reminders that have already passed in real-time
  const nowMs = now.getTime();
  const futureReminders = reminders.filter(r => new Date(r.at).getTime() > nowMs);

  // Sort chronologically ascending
  futureReminders.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Cap at 60 items as required for Android alarm limits
  return futureReminders.slice(0, 60);
}
