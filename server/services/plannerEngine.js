/**
 * SARTHI — Adaptive Capacity & Recovery Engine
 * 
 * Core Principle: A missed day must never automatically invalidate the next day.
 * 
 * Inputs:
 * - Priority: P1 (Essential), P2 (Important), P3 (Optional)
 * - Deadlines & Dependencies
 * - Available Daily Capacity (derived from timetable or settings)
 * - Estimated vs Actual Minutes (Partial completion preservation)
 * - Slack Days Allowance
 */

export class PlannerEngine {
  /**
   * Calculate effective remaining minutes for a task.
   */
  static getRemainingEffort(task) {
    if (task.status === 'completed') return 0;
    const est = Number(task.estimatedMinutes) || 0;
    const act = Number(task.actualMinutes) || 0;
    return Math.max(0, est - act);
  }

  /**
   * Sort tasks by scheduling priority:
   * 1. Hard deadlines (earlier deadlines first)
   * 2. Priority: P1 (Essential) > P2 (Important) > P3 (Optional)
   * 3. Protected status
   * 4. Remaining effort (shorter first for momentum, or preservation)
   */
  static rankTasks(tasks, targetDateStr = null) {
    return [...tasks].sort((a, b) => {
      // 1. Unmet dependencies must be scheduled after their prerequisites
      // 2. Urgent deadlines
      if (a.deadline && b.deadline) {
        if (a.deadline !== b.deadline) {
          return a.deadline.localeCompare(b.deadline);
        }
      } else if (a.deadline && !b.deadline) {
        return -1;
      } else if (!a.deadline && b.deadline) {
        return 1;
      }

      // 3. Priority weight: P1 = 1, P2 = 2, P3 = 3
      const priorityWeight = { P1: 1, P2: 2, P3: 3 };
      const weightA = priorityWeight[a.priority] || 2;
      const weightB = priorityWeight[b.priority] || 2;
      if (weightA !== weightB) return weightA - weightB;

      // 4. Protected tasks take precedence
      if (a.isProtected && !b.isProtected) return -1;
      if (!a.isProtected && b.isProtected) return 1;

      // 5. Remaining effort (smaller first)
      return PlannerEngine.getRemainingEffort(a) - PlannerEngine.getRemainingEffort(b);
    });
  }

  /**
   * Evaluate dependency constraints.
   * Returns true if all prerequisites of task are completed.
   */
  static areDependenciesMet(task, allTasksMap) {
    if (!task.dependencies || task.dependencies.length === 0) return true;
    for (const depId of task.dependencies) {
      const dep = allTasksMap.get(depId.toString());
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Generate an adaptive Replan Proposal for a day.
   * 
   * @param {Object} params
   * @param {string} params.targetDate - Date being replanned (YYYY-MM-DD)
   * @param {number} params.dailyCapacityMinutes - Available capacity for that date (e.g. 330)
   * @param {Array} params.existingScheduledTasks - Currently planned tasks for the date
   * @param {Array} params.missedOrUnfinishedTasks - Tasks not finished from yesterday or earlier
   * @param {Array} params.backlogTasks - Tasks in unscheduled pool
   * @param {Object} params.slackDayStatus - { available: number, used: number, isRequested: boolean }
   * @param {number} params.maxCatchupMinutes - Maximum extra catch-up allowed per day (default 60)
   * @returns {Object} proposal
   */
  static generateReplanProposal({
    targetDate,
    dailyCapacityMinutes = 330,
    existingScheduledTasks = [],
    missedOrUnfinishedTasks = [],
    backlogTasks = [],
    slackDayStatus = { available: 4, used: 0, isRequested: false },
    maxCatchupMinutes = 60
  }) {
    const reasons = [];
    const changes = [];
    const warnings = [];

    // Case 1: Slack Day Requested
    if (slackDayStatus.isRequested) {
      if (slackDayStatus.available > 0) {
        reasons.push(`Slack Day activated. Today's commitments deferred to protect recovery buffer without backlog penalty.`);
        const tasksToDefer = [...existingScheduledTasks, ...missedOrUnfinishedTasks];
        for (const t of tasksToDefer) {
          changes.push({
            taskId: t._id || t.id,
            title: t.title,
            action: 'defer_slack_day',
            originalDate: targetDate,
            newDate: null, // pushed to bounded backlog or next feasible slot
            reason: 'Deferred due to activated Slack Day'
          });
        }
        return {
          targetDate,
          isSlackDay: true,
          capacityMinutes: 0,
          allocatedMinutes: 0,
          acceptedTasks: [],
          deferredTasks: tasksToDefer.map(t => ({
            ...t,
            remainingMinutes: PlannerEngine.getRemainingEffort(t),
            deferReason: 'Slack Day recovery'
          })),
          unscheduledBacklog: [...backlogTasks, ...tasksToDefer],
          reasons,
          warnings,
          requiresConfirmation: true,
          actionRequired: 'Confirm Slack Day Activation'
        };
      } else {
        warnings.push(`Monthly Slack Day allowance (${slackDayStatus.used}/${slackDayStatus.used}) is fully exhausted. Generating standard capacity-constrained recovery plan.`);
      }
    }

    // Build task lookup map
    const allTasksMap = new Map();
    [...existingScheduledTasks, ...missedOrUnfinishedTasks, ...backlogTasks].forEach(t => {
      const id = (t._id || t.id || '').toString();
      if (id) allTasksMap.set(id, t);
    });

    // 1. Process missed or partially completed tasks
    const eligibleMissed = [];
    for (const t of missedOrUnfinishedTasks) {
      const remaining = PlannerEngine.getRemainingEffort(t);
      if (remaining <= 0) continue; // already finished

      if (t.actualMinutes > 0) {
        reasons.push(`Task "${t.title}": Preserved ${t.actualMinutes} min of completed work. Remaining ${remaining} min considered for scheduling.`);
      }

      if (!PlannerEngine.areDependenciesMet(t, allTasksMap)) {
        warnings.push(`Task "${t.title}" has unmet dependencies; cannot be scheduled today.`);
        changes.push({
          taskId: t._id || t.id,
          title: t.title,
          action: 'hold_dependency',
          reason: 'Waiting for prerequisite task completion'
        });
        continue;
      }

      eligibleMissed.push(t);
    }

    // 2. Pool of candidate tasks for today
    const candidatePool = [...existingScheduledTasks, ...eligibleMissed];

    // Deduplicate pool by ID
    const uniqueCandidatesMap = new Map();
    candidatePool.forEach(t => {
      const id = (t._id || t.id || '').toString();
      if (!uniqueCandidatesMap.has(id)) {
        uniqueCandidatesMap.set(id, t);
      }
    });

    const uniqueCandidates = Array.from(uniqueCandidatesMap.values());

    // 3. Rank candidates according to SARTHI priority rules
    const rankedCandidates = PlannerEngine.rankTasks(uniqueCandidates, targetDate);

    // 4. Fill available capacity
    // Max effective capacity = dailyCapacityMinutes + (if catchup needed, max extra buffer)
    const effectiveCapacity = dailyCapacityMinutes + maxCatchupMinutes;
    let currentAllocated = 0;
    const acceptedTasks = [];
    const deferredTasks = [];

    for (const task of rankedCandidates) {
      const remainingEffort = PlannerEngine.getRemainingEffort(task);

      // Check deadline conflict
      if (task.deadline && task.deadline < targetDate) {
        warnings.push(`Deadline Alert: Task "${task.title}" has deadline ${task.deadline} which has passed.`);
      }

      // Essential (P1) tasks are protected
      if (task.priority === 'P1' || task.isProtected) {
        if (currentAllocated + remainingEffort <= effectiveCapacity) {
          acceptedTasks.push({
            ...task,
            remainingMinutes: remainingEffort
          });
          currentAllocated += remainingEffort;
        } else {
          // Overload even with P1! Must flag conflict
          warnings.push(`CRITICAL CAPACITY OVERLOAD: Essential task "${task.title}" (${remainingEffort} min) exceeds remaining daily limit (${effectiveCapacity - currentAllocated} min). Requires user intervention.`);
          acceptedTasks.push({
            ...task,
            remainingMinutes: remainingEffort,
            isOverCapacity: true
          });
          currentAllocated += remainingEffort;
        }
        continue;
      }

      // P2 and P3 tasks
      if (currentAllocated + remainingEffort <= dailyCapacityMinutes) {
        acceptedTasks.push({
          ...task,
          remainingMinutes: remainingEffort
        });
        currentAllocated += remainingEffort;
      } else if (task.priority === 'P2' && currentAllocated + remainingEffort <= effectiveCapacity) {
        // Allow bounded catch-up for P2 up to maxCatchupMinutes
        reasons.push(`Task "${task.title}" (P2) scheduled using bounded catch-up buffer (${remainingEffort} min).`);
        acceptedTasks.push({
          ...task,
          remainingMinutes: remainingEffort
        });
        currentAllocated += remainingEffort;
      } else {
        // Defer P3 or overflowing P2
        const reasonText = task.priority === 'P3'
          ? `Optional task (P3) deferred to preserve focus on essentials.`
          : `Important task (P2) deferred to prevent daily cognitive overload (${effectiveCapacity} min ceiling).`;
        
        deferredTasks.push({
          ...task,
          remainingMinutes: remainingEffort,
          deferReason: reasonText
        });

        changes.push({
          taskId: task._id || task.id,
          title: task.title,
          priority: task.priority,
          action: 'defer',
          reason: reasonText
        });
      }
    }

    if (deferredTasks.length > 0) {
      reasons.push(`${deferredTasks.length} task(s) deliberately moved to backlog to maintain a realistic ${dailyCapacityMinutes} min day.`);
    }

    return {
      targetDate,
      isSlackDay: false,
      capacityMinutes: dailyCapacityMinutes,
      effectiveCapacityMinutes: effectiveCapacity,
      allocatedMinutes: currentAllocated,
      remainingFreeMinutes: Math.max(0, dailyCapacityMinutes - currentAllocated),
      isOverloaded: currentAllocated > dailyCapacityMinutes,
      acceptedTasks,
      deferredTasks,
      changes,
      reasons,
      warnings,
      requiresConfirmation: changes.length > 0 || warnings.length > 0
    };
  }

  /**
   * Distribute deferred tasks gradually across upcoming days.
   * Ensures no upcoming day gets overloaded with > dailyCapacity.
   */
  static distributeCatchup({ deferredTasks, upcomingDaysSchedules, dailyMaxWorkMinutes = 480 }) {
    const distributionPlan = [];
    const unplacedTasks = [];

    const tasksToPlace = [...deferredTasks].sort((a, b) => {
      const pMap = { P1: 1, P2: 2, P3: 3 };
      return (pMap[a.priority] || 2) - (pMap[b.priority] || 2);
    });

    for (const task of tasksToPlace) {
      let placed = false;
      const effort = PlannerEngine.getRemainingEffort(task);

      for (const day of upcomingDaysSchedules) {
        const currentTotal = day.scheduledMinutes || 0;
        const available = (day.capacityMinutes || 330) - currentTotal;

        if (effort <= available && (currentTotal + effort) <= dailyMaxWorkMinutes) {
          day.scheduledMinutes = currentTotal + effort;
          day.assignedTasks = day.assignedTasks || [];
          day.assignedTasks.push(task);
          distributionPlan.push({
            taskId: task._id || task.id,
            title: task.title,
            targetDate: day.date,
            effortMinutes: effort
          });
          placed = true;
          break;
        }
      }

      if (!placed) {
        unplacedTasks.push({
          ...task,
          remainingMinutes: effort,
          status: 'backlog'
        });
      }
    }

    return {
      distributionPlan,
      unplacedTasks
    };
  }
}
