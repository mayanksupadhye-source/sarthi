import { CurriculumActivity } from '../models/CurriculumActivity.js';
import { Task } from '../models/Task.js';
import { Course } from '../models/Course.js';
import { OratoryWeek } from '../models/OratoryWeek.js';
import { DailyPlan } from '../models/DailyPlan.js';
import { ExecutionRecord } from '../models/ExecutionRecord.js';
import { RecoveryLedger } from '../models/RecoveryLedger.js';
import { getTodayString } from '../utils/timeFormat.js';

export class ExecutionSyncService {
  /**
   * Primary canonical method to log execution time (partial or full).
   * Generates an immutable ExecutionRecord, updates Task, Activity, Course and DailyPlan atomically.
   */
  static async recordWork({
    userId,
    taskId,
    activityId,
    courseSlug,
    minutesSpent,
    date = getTodayString(),
    type = 'regular',
    notes = '',
    isCompleted = false,
    confidence,
    operationId = null,
  }) {
    const minutes = Number(minutesSpent) || 0;
    if (minutes <= 0 && !isCompleted) return null;

    // Idempotency check: if an operationId was provided, verify if this operation was already processed
    if (operationId) {
      const existing = await ExecutionRecord.findOne({ userId, operationId: String(operationId).trim() });
      if (existing) {
        // Return existing results without double-counting
        const [existingTask, existingAct] = await Promise.all([
          existing.taskId ? Task.findOne({ _id: existing.taskId, userId }) : null,
          existing.activityId ? CurriculumActivity.findOne({ _id: existing.activityId, userId }) : null,
        ]);
        return {
          executionRecord: existing,
          task: existingTask,
          activity: existingAct,
          isDuplicate: true,
        };
      }
    }

    // 1. Create an immutable ExecutionRecord
    let executionRecord = null;
    if (minutes > 0) {
      try {
        executionRecord = await ExecutionRecord.create({
          userId,
          operationId: operationId ? String(operationId).trim() : null,
          courseSlug: courseSlug || null,
          activityId: activityId || null,
          taskId: taskId || null,
          module: courseSlug ? 'course' : 'general',
          date,
          minutesSpent: minutes,
          type,
          notes: notes.trim()
        });
      } catch (err) {
        // If a duplicate key error on (userId, operationId) occurs due to race conditions
        if (err.code === 11000 && operationId) {
          const existing = await ExecutionRecord.findOne({ userId, operationId: String(operationId).trim() });
          if (existing) {
            const [existingTask, existingAct] = await Promise.all([
              existing.taskId ? Task.findOne({ _id: existing.taskId, userId }) : null,
              existing.activityId ? CurriculumActivity.findOne({ _id: existing.activityId, userId }) : null,
            ]);
            return {
              executionRecord: existing,
              task: existingTask,
              activity: existingAct,
              isDuplicate: true,
            };
          }
        }
        throw err;
      }
    }

    // 2. Synchronize Task if linked
    let task = null;
    if (taskId) {
      task = await Task.findOne({ _id: taskId, userId });
      if (task) {
        task.actualMinutes = (task.actualMinutes || 0) + minutes;
        if (isCompleted) {
          task.remainingMinutes = 0;
          task.status = 'completed';
          task.completedAt = new Date();
        } else {
          task.remainingMinutes = Math.max(0, task.estimatedMinutes - task.actualMinutes);
          if (task.remainingMinutes === 0) {
            task.status = 'completed';
            task.completedAt = new Date();
          } else {
            task.status = 'in-progress';
          }
        }
        if (notes) {
          task.description = task.description ? `${task.description}\n[${date}]: ${notes}` : notes;
        }
        await task.save();

        // If activity was not passed, see if task links to one
        if (!activityId) {
          const linkedAct = await CurriculumActivity.findOne({ userId, taskId: task._id });
          if (linkedAct) activityId = linkedAct._id;
        }
      }
    }

    // 3. Synchronize CurriculumActivity if linked
    let activity = null;
    if (activityId) {
      activity = await CurriculumActivity.findOne({ _id: activityId, userId });
      if (activity) {
        activity.actualMinutes = (activity.actualMinutes || 0) + minutes;
        const totalEffort = activity.totalEffortMinutes || Math.round((activity.contentDurationMinutes || 30) * (activity.practiceMultiplier || 1.6));
        
        if (isCompleted || activity.actualMinutes >= totalEffort) {
          activity.remainingMinutes = 0;
          activity.isWatched = true;
          activity.isCodeDone = true;
          activity.status = 'completed';
          if (!activity.completedAt) activity.completedAt = new Date();
        } else {
          activity.remainingMinutes = Math.max(0, totalEffort - activity.actualMinutes);
          activity.status = 'in-progress';
        }

        if (confidence !== undefined) activity.confidence = Number(confidence);
        if (notes) activity.notes = activity.notes ? `${activity.notes}\n[${date}]: ${notes}` : notes;
        await activity.save();

        // Synchronize OratoryWeek if this activity is an oratory speech drill
        if (activity.courseSlug === 'oratory') {
          try {
            await OratoryWeek.findOneAndUpdate(
              { userId, weekNumber: activity.activityNumber },
              {
                $set: {
                  isCompleted: activity.status === 'completed',
                  completedAt: activity.status === 'completed' ? (activity.completedAt || new Date()) : null,
                  updatedAt: new Date(),
                },
              }
            );
          } catch (e) {
            console.warn('[SyncService] OratoryWeek sync notice:', e.message);
          }
        }

        // Sync Course progress and check if all activities are completed
        try {
          const course = await Course.findOne({ userId, slug: activity.courseSlug });
          if (course) {
            if (Array.isArray(course.sections) && course.sections.length > 0) {
              for (const sec of course.sections) {
                if (sec.sectionNumber === activity.sectionNumber) {
                  const lec = sec.lectures.find(l => l.lectureNumber === activity.activityNumber);
                  if (lec) {
                    if (activity.status === 'completed') {
                      lec.isWatched = true;
                      lec.isCodeDone = true;
                      lec.completedAt = activity.completedAt || new Date();
                    }
                    if (confidence !== undefined) lec.confidence = Number(confidence);
                    break;
                  }
                }
              }
              course.recalculateProgress();
            }

            // Recalculate accurately from CurriculumActivity records
            const allActs = await CurriculumActivity.find({ userId, courseSlug: activity.courseSlug });
            if (allActs.length > 0) {
              course.totalLectures = allActs.length;
              course.completedLectures = allActs.filter(a => a.status === 'completed' || (a.isWatched && a.isCodeDone)).length;
              course.totalMinutes = allActs.reduce((s, a) => s + (a.totalEffortMinutes || 0), 0);
              course.completedMinutes = allActs.filter(a => a.status === 'completed' || (a.isWatched && a.isCodeDone)).reduce((s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0), 0);
            }

            // When the last activity is completed, automatically mark the course/exploration as archived (completed)
            if (course.totalLectures > 0 && course.completedLectures >= course.totalLectures) {
              course.status = 'archived';
            }
            await course.save();
          }
        } catch (e) {
          console.warn('[SyncService] Course progress sync notice:', e.message);
        }
      }
    }

    // 4. Update DailyPlan if task or activity belongs to that plan
    try {
      const plan = await DailyPlan.findOne({ userId, date });
      if (plan && Array.isArray(plan.tasks)) {
        const pTask = plan.tasks.find(pt => 
          (taskId && pt.taskId?.toString() === taskId.toString()) ||
          (activity && activity.taskId && pt.taskId?.toString() === activity.taskId.toString())
        );
        if (pTask) {
          pTask.actualMinutes = (pTask.actualMinutes || 0) + minutes;
          if (isCompleted || pTask.actualMinutes >= (pTask.estimatedMinutes || 30)) {
            pTask.remainingMinutes = 0;
            pTask.status = 'completed';
          } else {
            pTask.remainingMinutes = Math.max(0, (pTask.estimatedMinutes || 30) - pTask.actualMinutes);
            pTask.status = 'in-progress';
          }
          await plan.save();
        }
      }
    } catch (e) {
      console.warn('[SyncService] DailyPlan sync notice:', e.message);
    }

    // 5. If type is 'recovery', deduct from active RecoveryLedger
    if (type === 'recovery' && minutes > 0) {
      await ExecutionSyncService.consumeRecoveryMinutes({
        userId,
        minutesRecovered: minutes,
        date,
        courseSlug,
        notes
      });
    }

    // 5b. If an activity or task is now completed, close any open RecoveryLedger entries for it
    const nowCompleted = Boolean(isCompleted || activity?.status === 'completed' || task?.status === 'completed');
    if (nowCompleted && (activityId || taskId) && RecoveryLedger.db?.readyState === 1) {
      const orFilters = [];
      if (activityId) orFilters.push({ activityId });
      if (taskId) orFilters.push({ taskId });
      const openLedgers = await RecoveryLedger.find({
        userId,
        status: { $in: ['active', 'partial'] },
        $or: orFilters,
      });
      for (const ledger of openLedgers) {
        const rem = ledger.remainingRecoveryMinutes || 0;
        ledger.recoveredMinutes = (ledger.recoveredMinutes || 0) + rem;
        ledger.remainingRecoveryMinutes = 0;
        ledger.status = 'recovered';
        ledger.updatedAt = new Date();
        ledger.history.push({
          date,
          minutesRecovered: rem,
          notes: notes || 'Completed directly; removed from pending recovery',
        });
        await ledger.save();
      }
    }

    return {
      executionRecord,
      task,
      activity
    };
  }

  /**
   * Completes a curriculum activity via canonical recordWork.
   */
  static async completeActivity({ userId, activityId, actualMinutes, confidence, operationId }) {
    const activity = await CurriculumActivity.findOne({ _id: activityId, userId });
    if (!activity) return null;

    const effort = Number(actualMinutes) || activity.remainingMinutes || activity.totalEffortMinutes || 30;

    const result = await ExecutionSyncService.recordWork({
      userId,
      activityId: activity._id,
      taskId: activity.taskId,
      courseSlug: activity.courseSlug,
      minutesSpent: effort,
      isCompleted: true,
      confidence,
      operationId,
    });

    return result.activity;
  }

  /**
   * Completes a task via canonical recordWork.
   */
  static async completeTask({ userId, taskId, actualMinutes, operationId }) {
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) return null;

    const effort = Number(actualMinutes) || task.remainingMinutes || task.estimatedMinutes || 30;
    const isRecovery = task.category === 'recovery' || (task.title && task.title.toLowerCase().includes('recovery'));

    const result = await ExecutionSyncService.recordWork({
      userId,
      taskId: task._id,
      minutesSpent: effort,
      isCompleted: true,
      type: isRecovery ? 'recovery' : 'regular',
      operationId,
    });

    return result.task;
  }

  /**
   * Logs a missed session into the RecoveryLedger without dumping the burden on tomorrow.
   */
  static async recordMissedWork({
    userId,
    sourceDate,
    title,
    courseSlug,
    taskId,
    activityId,
    missedMinutes
  }) {
    const minutes = Number(missedMinutes) || 0;
    if (minutes <= 0) return null;

    // Prevent duplicate active recovery entries for the same source item/date
    const dupQuery = {
      userId,
      sourceDate,
      status: { $in: ['active', 'partial'] },
    };
    if (activityId) dupQuery.activityId = activityId;
    else if (taskId) dupQuery.taskId = taskId;
    else dupQuery.title = title;

    const existing = await RecoveryLedger.findOne(dupQuery);
    if (existing) return existing;

    return await RecoveryLedger.create({
      userId,
      sourceDate,
      title,
      courseSlug: courseSlug || null,
      taskId: taskId || null,
      activityId: activityId || null,
      originalMissedMinutes: minutes,
      recoveredMinutes: 0,
      remainingRecoveryMinutes: minutes,
      status: 'active'
    });
  }

  /**
   * Deducts confirmed recovery work from the user's active recovery ledgers (FIFO).
   */
  static async consumeRecoveryMinutes({ userId, minutesRecovered, date, courseSlug, notes }) {
    let remaining = Number(minutesRecovered) || 0;
    if (remaining <= 0) return;

    const query = { userId, status: { $in: ['active', 'partial'] } };
    if (courseSlug) query.courseSlug = courseSlug;

    const ledgers = await RecoveryLedger.find(query).sort({ sourceDate: 1 });

    for (const item of ledgers) {
      if (remaining <= 0) break;

      const deduct = Math.min(remaining, item.remainingRecoveryMinutes);
      item.recoveredMinutes += deduct;
      item.remainingRecoveryMinutes -= deduct;
      remaining -= deduct;

      item.history.push({
        date,
        minutesRecovered: deduct,
        notes: notes || 'Gradual capacity recovery'
      });

      if (item.remainingRecoveryMinutes === 0) {
        item.status = 'recovered';
      } else {
        item.status = 'partial';
      }

      item.updatedAt = new Date();
      await item.save();
    }
  }

  /**
   * Returns current active recovery balance for a user.
   */
  static async getRecoveryBalance(userId) {
    const active = await RecoveryLedger.find({ userId, status: { $in: ['active', 'partial'] } });
    const totalRemaining = active.reduce((sum, item) => sum + item.remainingRecoveryMinutes, 0);
    const totalOriginal = active.reduce((sum, item) => sum + item.originalMissedMinutes, 0);
    const totalRecovered = active.reduce((sum, item) => sum + item.recoveredMinutes, 0);

    return {
      activeCount: active.length,
      totalOriginalMinutes: totalOriginal,
      totalRecoveredMinutes: totalRecovered,
      remainingMinutes: totalRemaining,
      items: active
    };
  }
}
