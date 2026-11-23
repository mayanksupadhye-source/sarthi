import { CurriculumActivity } from '../models/CurriculumActivity.js';
import { Task } from '../models/Task.js';
import { Course } from '../models/Course.js';
import { DailyPlan } from '../models/DailyPlan.js';
import { ExecutionRecord } from '../models/ExecutionRecord.js';
import { RecoveryLedger } from '../models/RecoveryLedger.js';

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
    date = new Date().toISOString().split('T')[0],
    type = 'regular',
    notes = '',
    isCompleted = false,
    confidence
  }) {
    const minutes = Number(minutesSpent) || 0;
    if (minutes <= 0 && !isCompleted) return null;

    // 1. Create an immutable ExecutionRecord
    let executionRecord = null;
    if (minutes > 0) {
      executionRecord = await ExecutionRecord.create({
        userId,
        courseSlug: courseSlug || null,
        activityId: activityId || null,
        taskId: taskId || null,
        module: courseSlug ? 'course' : 'general',
        date,
        minutesSpent: minutes,
        type,
        notes: notes.trim()
      });
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

    return {
      executionRecord,
      task,
      activity
    };
  }

  /**
   * Completes a curriculum activity via canonical recordWork.
   */
  static async completeActivity({ userId, activityId, actualMinutes, confidence }) {
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
      confidence
    });

    return result.activity;
  }

  /**
   * Completes a task via canonical recordWork.
   */
  static async completeTask({ userId, taskId, actualMinutes }) {
    const task = await Task.findOne({ _id: taskId, userId });
    if (!task) return null;

    const effort = Number(actualMinutes) || task.remainingMinutes || task.estimatedMinutes || 30;
    const isRecovery = task.category === 'recovery' || (task.title && task.title.toLowerCase().includes('recovery'));

    const result = await ExecutionSyncService.recordWork({
      userId,
      taskId: task._id,
      minutesSpent: effort,
      isCompleted: true,
      type: isRecovery ? 'recovery' : 'regular'
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
