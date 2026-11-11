import { Task } from '../models/Task.js';
import { DailyPlan } from '../models/DailyPlan.js';
import { SlackDayLog } from '../models/SlackDayLog.js';
import { ScheduleTemplate } from '../models/ScheduleTemplate.js';
import { Setting } from '../models/Setting.js';
import { PlannerEngine } from '../services/plannerEngine.js';
import { getTodayString } from '../utils/timeFormat.js';

function getMonthKey(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export async function getToday(req, res, next) {
  try {
    const today = req.query.date || getTodayString();
    const userId = req.user.id;

    // 1. Get user settings
    const settings = await Setting.findOne({ userId }) || {
      dailyMaxWorkMinutes: 480,
      monthlySlackDayAllowance: 4
    };

    // 2. Determine day type (weekday / saturday / sunday)
    const dayOfWeek = new Date(today).getDay(); // 0 is Sunday, 6 is Saturday
    let dayType = 'weekday';
    if (dayOfWeek === 0) dayType = 'sunday';
    else if (dayOfWeek === 6) dayType = 'saturday';

    // 3. Get timetable template blocks for today
    const template = await ScheduleTemplate.findOne({ userId, dayType }) || 
      await ScheduleTemplate.findOne({ userId, isDefault: true });

    const blocks = template ? template.blocks : [];

    // Calculate available study/work capacity from non-protected blocks
    let studyCapacityMinutes = 0;
    if (blocks && blocks.length > 0) {
      studyCapacityMinutes = blocks
        .filter(b => ['study', 'webdev', 'dsa', 'oratory', 'exploration'].includes(b.category))
        .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    }
    if (studyCapacityMinutes === 0) {
      studyCapacityMinutes = 330; // default 5.5 hours realistic study window
    }

    // 4. Get tasks scheduled for today
    const scheduledTasks = await Task.find({
      userId,
      scheduledDate: today
    }).sort({ priority: 1, deadline: 1 });

    // 5. Get missed tasks from past dates that are still pending/in-progress
    const missedTasks = await Task.find({
      userId,
      scheduledDate: { $lt: today, $ne: null },
      status: { $in: ['pending', 'in-progress'] }
    }).sort({ priority: 1, deadline: 1 });

    // 6. Get backlog tasks (no scheduled date or deferred)
    const backlogTasks = await Task.find({
      userId,
      $or: [{ scheduledDate: null }, { isDeferred: true }],
      status: { $in: ['pending', 'in-progress'] }
    }).limit(20);

    // 7. Get or initialize DailyPlan
    let dailyPlan = await DailyPlan.findOne({ userId, date: today });
    if (!dailyPlan) {
      dailyPlan = await DailyPlan.create({
        userId,
        date: today,
        dayType,
        targetCapacityMinutes: studyCapacityMinutes,
        allocatedMinutes: scheduledTasks.reduce((sum, t) => sum + (t.remainingMinutes || t.estimatedMinutes), 0),
        tasks: scheduledTasks.map(t => ({
          taskId: t._id,
          title: t.title,
          priority: t.priority,
          estimatedMinutes: t.estimatedMinutes,
          remainingMinutes: t.remainingMinutes,
          actualMinutes: t.actualMinutes,
          status: t.status,
          isProtected: t.isProtected
        }))
      });
    }

    // 8. Slack days summary for this month
    const monthKey = getMonthKey(today);
    const slackDaysCount = await SlackDayLog.countDocuments({ userId, monthKey });
    const slackDayAllowance = settings.monthlySlackDayAllowance || 4;

    return res.json({
      success: true,
      today,
      dayType,
      targetCapacityMinutes: studyCapacityMinutes,
      timetableBlocks: blocks,
      dailyPlan,
      scheduledTasks,
      missedTasksCount: missedTasks.length,
      missedTasks,
      backlogTasksCount: backlogTasks.length,
      slackDayStatus: {
        allowance: slackDayAllowance,
        used: slackDaysCount,
        remaining: Math.max(0, slackDayAllowance - slackDaysCount),
        isTodaySlackDay: Boolean(dailyPlan && dailyPlan.isSlackDay)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function replanDay(req, res, next) {
  try {
    const { targetDate = getTodayString(), requestSlackDay = false, slackDayReason = '' } = req.body;
    const userId = req.user.id;

    // 1. Fetch settings
    const settings = await Setting.findOne({ userId }) || {
      dailyMaxWorkMinutes: 480,
      monthlySlackDayAllowance: 4
    };

    // 2. Fetch timetable capacity
    const dayOfWeek = new Date(targetDate).getDay();
    let dayType = 'weekday';
    if (dayOfWeek === 0) dayType = 'sunday';
    else if (dayOfWeek === 6) dayType = 'saturday';

    const template = await ScheduleTemplate.findOne({ userId, dayType });
    let studyCapacityMinutes = 330;
    if (template && template.blocks) {
      studyCapacityMinutes = template.blocks
        .filter(b => ['study', 'webdev', 'dsa', 'oratory', 'exploration'].includes(b.category))
        .reduce((sum, b) => sum + (b.durationMinutes || 0), 0) || 330;
    }

    // 3. Existing tasks for targetDate
    const existingScheduled = await Task.find({ userId, scheduledDate: targetDate });

    // 4. Missed tasks from past dates
    const missedTasks = await Task.find({
      userId,
      scheduledDate: { $lt: targetDate, $ne: null },
      status: { $in: ['pending', 'in-progress'] }
    });

    // 5. Backlog
    const backlog = await Task.find({
      userId,
      $or: [{ scheduledDate: null }, { isDeferred: true }],
      status: { $in: ['pending', 'in-progress'] }
    });

    // 6. Slack Day allowance
    const monthKey = getMonthKey(targetDate);
    const slackDaysCount = await SlackDayLog.countDocuments({ userId, monthKey });
    const allowance = settings.monthlySlackDayAllowance || 4;

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate,
      dailyCapacityMinutes: studyCapacityMinutes,
      existingScheduledTasks: existingScheduled,
      missedOrUnfinishedTasks: missedTasks,
      backlogTasks: backlog,
      slackDayStatus: {
        available: Math.max(0, allowance - slackDaysCount),
        used: slackDaysCount,
        isRequested: Boolean(requestSlackDay)
      },
      maxCatchupMinutes: 60
    });

    return res.json({
      success: true,
      proposal
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmReplan(req, res, next) {
  try {
    const { targetDate = getTodayString(), acceptedTaskIds = [], deferredTaskIds = [], isSlackDay = false, slackDayReason = '' } = req.body;
    const userId = req.user.id;

    // 1. Update accepted tasks -> scheduled for targetDate, not deferred
    if (acceptedTaskIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: acceptedTaskIds }, userId },
        { $set: { scheduledDate: targetDate, isDeferred: false, status: 'pending' } }
      );
    }

    // 2. Update deferred tasks -> scheduledDate = null, isDeferred = true
    if (deferredTaskIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: deferredTaskIds }, userId },
        { 
          $set: { 
            scheduledDate: null, 
            isDeferred: true, 
            deferReason: isSlackDay ? 'Deferred via Slack Day' : 'Deferred by adaptive capacity replanner' 
          } 
        }
      );
    }

    // 3. If Slack Day, log it
    if (isSlackDay) {
      const monthKey = getMonthKey(targetDate);
      await SlackDayLog.create({
        userId,
        date: targetDate,
        monthKey,
        reason: slackDayReason || 'Intentional recovery / disruption buffer',
        tasksDeferredCount: deferredTaskIds.length,
        deferredTaskIds
      });
    }

    // 4. Update DailyPlan
    const acceptedTasks = await Task.find({ _id: { $in: acceptedTaskIds }, userId });
    const totalAllocated = acceptedTasks.reduce((sum, t) => sum + (t.remainingMinutes || t.estimatedMinutes), 0);

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: targetDate },
      {
        $set: {
          allocatedMinutes: totalAllocated,
          isSlackDay: Boolean(isSlackDay),
          slackDayReason: slackDayReason || '',
          status: 'recalculated'
        },
        $inc: { replanCount: 1 },
        $push: {
          replanHistory: {
            timestamp: new Date(),
            reason: isSlackDay ? 'Slack Day activated' : 'Capacity rebalanced',
            proposalSummary: `Scheduled: ${acceptedTaskIds.length} tasks (${totalAllocated}m). Deferred: ${deferredTaskIds.length} tasks.`,
            tasksModified: acceptedTaskIds.length + deferredTaskIds.length
          }
        }
      },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: 'Replan proposal applied successfully.',
      plan
    });
  } catch (err) {
    next(err);
  }
}

export async function getSlackDays(req, res, next) {
  try {
    const userId = req.user.id;
    const today = getTodayString();
    const monthKey = req.query.month || getMonthKey(today);

    const settings = await Setting.findOne({ userId }) || { monthlySlackDayAllowance: 4 };
    const logs = await SlackDayLog.find({ userId, monthKey }).sort({ date: -1 });
    const count = logs.length;
    const allowance = settings.monthlySlackDayAllowance || 4;

    return res.json({
      success: true,
      monthKey,
      allowance,
      usedCount: count,
      remainingCount: Math.max(0, allowance - count),
      logs
    });
  } catch (err) {
    next(err);
  }
}
