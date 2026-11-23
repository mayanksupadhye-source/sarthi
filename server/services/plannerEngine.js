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
   * 0. Exam subjects (when exam mode is active)
   * 1. Hard deadlines (earlier deadlines first)
   * 2. Priority: P1 (Essential) > P2 (Important) > P3 (Optional)
   * 3. Protected status
   * 4. Remaining effort (shorter first for momentum, or preservation)
   */
  static rankTasks(tasks, targetDateStr = null, examMode = null) {
    return [...tasks].sort((a, b) => {
      // 0. If exam mode is active, prioritize academic/exam tasks and focus subjects
      if (examMode && (examMode.enabled || examMode.isExamDay)) {
        const focus = Array.isArray(examMode.focusSubjects) ? examMode.focusSubjects : [];
        const isExamA = ['academic', 'exam'].includes(a.category) || focus.includes(a.category) || (a.title && /exam|revision|academic/i.test(a.title));
        const isExamB = ['academic', 'exam'].includes(b.category) || focus.includes(b.category) || (b.title && /exam|revision|academic/i.test(b.title));
        if (isExamA && !isExamB) return -1;
        if (!isExamA && isExamB) return 1;
      }

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
    slackDayStatus = { available: 3, used: 0, isRequested: false },
    maxCatchupMinutes = 60,
    examMode = null
  }) {
    const reasons = [];
    const changes = [];
    const warnings = [];

    if (examMode && (examMode.enabled || examMode.isExamDay)) {
      reasons.push('Exam preparation phase active: academic revision prioritised, optional exploration throttled.');
    }

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
    const rankedCandidates = PlannerEngine.rankTasks(uniqueCandidates, targetDate, examMode);

    // 4. Fill available capacity
    // Max effective capacity = dailyCapacityMinutes + (if catchup needed, max extra buffer)
    const effectiveCapacity = dailyCapacityMinutes + maxCatchupMinutes;
    let currentAllocated = 0;
    const acceptedTasks = [];
    const deferredTasks = [];

    for (const task of rankedCandidates) {
      const remainingEffort = PlannerEngine.getRemainingEffort(task);

      // In exam mode, throttle optional explorations and non-essential P3 tasks
      if (examMode && (examMode.enabled || examMode.isExamDay) && (task.category === 'exploration' || task.priority === 'P3')) {
        const examDeferReason = 'Deferred to protect cognitive capacity during exam preparation';
        deferredTasks.push({
          ...task,
          remainingMinutes: remainingEffort,
          deferReason: examDeferReason
        });
        changes.push({
          taskId: task._id || task.id,
          title: task.title,
          priority: task.priority,
          action: 'defer',
          reason: examDeferReason
        });
        continue;
      }

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

  /**
   * Section-Aware Dynamic Curriculum Allocation
   * 
   * Maps uncompleted curriculum activities to timetable study blocks.
   * Respects section/module boundaries without arbitrary fragmentation.
   * 
   * @param {Object} params
   * @param {Array} params.blocks - Schedule blocks for the day
   * @param {Array} params.activities - Uncompleted curriculum activities
   * @param {number} params.minCoherentMinutes - Minimum fragment window (default 15 mins)
   * @returns {Object} allocation
   */
  static allocateCurriculumToBlocks({ blocks = [], activities = [], minCoherentMinutes = 15 }) {
    // 1. Identify study / learning blocks
    const studyBlocks = blocks.filter(b => 
      ['study', 'webdev', 'dsa', 'oratory', 'exploration'].includes(b.category) ||
      b.blockType === 'learning' ||
      b.blockType === 'exploration' ||
      Boolean(b.courseSlug)
    );

    const blockAllocations = [];
    const allocatedActivityIds = new Set();
    const allocatedActivities = [];
    let totalAllocatedMinutes = 0;

    const uncompleted = activities.filter(a => a.status !== 'completed');

    // Group activities by courseSlug, preserving sequential section order
    const courseActivities = new Map();
    for (const act of uncompleted) {
      const slug = act.courseSlug || 'general';
      if (!courseActivities.has(slug)) {
        courseActivities.set(slug, []);
      }
      courseActivities.get(slug).push(act);
    }

    // Sort each course's activities by sectionNumber asc, activityNumber asc
    for (const acts of courseActivities.values()) {
      acts.sort((a, b) => {
        const secA = Number(a.sectionNumber) || 0;
        const secB = Number(b.sectionNumber) || 0;
        if (secA !== secB) return secA - secB;
        return (Number(a.activityNumber) || 0) - (Number(b.activityNumber) || 0);
      });
    }

    // 2. Iterate through study blocks
    for (const block of studyBlocks) {
      let remainingBlockMinutes = block.durationMinutes || 0;
      const assigned = [];
      const targetSlug = block.courseSlug || (
        block.category === 'dsa' ? 'dsa' :
        block.category === 'webdev' ? 'web-development' :
        block.category === 'oratory' ? 'oratory' :
        block.category === 'exploration' ? 'exploration' :
        null
      );

      const candidateSlugs = targetSlug 
        ? [targetSlug] 
        : Array.from(courseActivities.keys());

      for (const slug of candidateSlugs) {
        const acts = courseActivities.get(slug) || [];
        
        for (const act of acts) {
          const actId = (act._id || act.activityId || act.id || '').toString();
          if (allocatedActivityIds.has(actId)) continue;

          const effort = act.remainingMinutes || act.totalEffortMinutes || act.estimatedExecutionMinutes || 30;

          // If the whole activity fits comfortably
          if (effort <= remainingBlockMinutes) {
            assigned.push({
              activityId: actId,
              courseSlug: act.courseSlug,
              sectionNumber: act.sectionNumber,
              sectionTitle: act.sectionTitle,
              activityNumber: act.activityNumber,
              title: act.title,
              allocatedMinutes: effort,
              status: act.status || 'pending'
            });
            allocatedActivityIds.add(actId);
            allocatedActivities.push(act);
            remainingBlockMinutes -= effort;
            totalAllocatedMinutes += effort;
          } 
          // If activity slightly exceeds remaining window (within 20% leeway) and block has meaningful time
          else if (remainingBlockMinutes >= minCoherentMinutes && (effort - remainingBlockMinutes) <= Math.max(10, remainingBlockMinutes * 0.2)) {
            assigned.push({
              activityId: actId,
              courseSlug: act.courseSlug,
              sectionNumber: act.sectionNumber,
              sectionTitle: act.sectionTitle,
              activityNumber: act.activityNumber,
              title: act.title,
              allocatedMinutes: effort,
              status: act.status || 'pending',
              note: 'Allocated with coherent section boundary completion'
            });
            allocatedActivityIds.add(actId);
            allocatedActivities.push(act);
            totalAllocatedMinutes += effort;
            remainingBlockMinutes = 0;
            break;
          }

          if (remainingBlockMinutes < minCoherentMinutes) {
            break;
          }
        }

        if (remainingBlockMinutes < minCoherentMinutes) {
          break;
        }
      }

      blockAllocations.push({
        blockId: block.blockId,
        label: block.label,
        category: block.category,
        courseSlug: block.courseSlug,
        startTime: block.startTime,
        endTime: block.endTime,
        durationMinutes: block.durationMinutes,
        assignedActivities: assigned,
        usedMinutes: (block.durationMinutes || 0) - remainingBlockMinutes,
        freeMinutes: Math.max(0, remainingBlockMinutes)
      });
    }

    const unallocated = uncompleted.filter(a => {
      const actId = (a._id || a.activityId || a.id || '').toString();
      return !allocatedActivityIds.has(actId);
    });

    return {
      blockAllocations,
      allocatedActivityIds: Array.from(allocatedActivityIds),
      allocatedActivitiesCount: allocatedActivityIds.size,
      totalAllocatedMinutes,
      unallocatedCount: unallocated.length,
      unallocatedActivities: unallocated
    };
  }

  /**
   * Distributes course activities dynamically across a timeline between startDate and targetDate.
   * Accurately accounts for realistic constraints:
   *  - 13-15 days of exams (per 5-month semester standard window)
   *  - 2-3 hackathon sprint days per month (24-hour sprint focus)
   *  - 2-3 emergency slack day buffers per month
   *  - Uses standard weekday and weekend timetable study blocks (ignoring holiday templates, which serve as speed-up opportunities)
   *  - Evaluates practice multiplier feasibility and provides coaching recommendations
   */
  static distributeCourseTimeline({
    startDate,
    targetDate,
    courseSlug,
    activities = [],
    weekdayBlocks = [],
    weekendBlocks = [],
    dedicatedMinutesPerDay = null,
    knownExams = [],
    knownHackathons = [],
    knownSlackDays = [],
    minCoherentMinutes = 15,
  }) {
    const startDt = new Date(startDate);
    const targetDt = new Date(targetDate);
    const daySpan = Math.max(1, Math.round((targetDt - startDt) / (1000 * 60 * 60 * 24)) + 1);
    const monthSpan = Math.max(1, daySpan / 30);

    const reservedExamDaysCount = Math.min(15, Math.max(2, Math.round(monthSpan * 3)));
    const reservedHackathonDaysCount = Math.min(12, Math.max(1, Math.round(monthSpan * 2.2)));
    const reservedSlackDaysCount = Math.min(15, Math.max(2, Math.round(monthSpan * 2.5)));

    const examDateSet = new Set(
      knownExams.flatMap((e) => [
        e.examDate,
        ...(e.preparationDates || []).map((pd) => pd.date || pd),
      ]).filter(Boolean),
    );
    const hackathonDateSet = new Set();
    knownHackathons.forEach((h) => {
      if (h.startDate && h.endDate) {
        let cur = new Date(h.startDate);
        const endH = new Date(h.endDate);
        while (cur <= endH) {
          hackathonDateSet.add(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    const slackDateSet = new Set(knownSlackDays.map((s) => s.date || s).filter(Boolean));

    const timelineDays = [];
    let curDate = new Date(startDt);
    for (let i = 0; i < daySpan; i++) {
      const dateStr = curDate.toISOString().slice(0, 10);
      const dayOfWeek = curDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const isExam = examDateSet.has(dateStr);
      const isHackathon = hackathonDateSet.has(dateStr);
      const isSlack = slackDateSet.has(dateStr);

      const templateBlocks = isWeekend ? weekendBlocks : weekdayBlocks;
      let dayStudyCapacity = 0;

      if (dedicatedMinutesPerDay && Number(dedicatedMinutesPerDay) > 0) {
        dayStudyCapacity = Number(dedicatedMinutesPerDay);
      } else if (templateBlocks && templateBlocks.length > 0) {
        const matchingBlocks = templateBlocks.filter(
          (b) =>
            b.courseSlug === courseSlug ||
            b.category === courseSlug ||
            ['study', 'webdev', 'dsa', 'oratory', 'exploration'].includes(b.category) ||
            b.blockType === 'learning' ||
            b.blockType === 'exploration',
        );
        dayStudyCapacity = matchingBlocks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
      }

      if (dayStudyCapacity === 0) {
        dayStudyCapacity = isWeekend ? 120 : 90;
      }

      timelineDays.push({
        date: dateStr,
        dayOfWeek,
        isWeekend,
        isExam,
        isHackathon,
        isSlack,
        availableCapacity: isExam || isHackathon || isSlack ? 0 : dayStudyCapacity,
        standardCapacity: dayStudyCapacity,
        allocatedActivities: [],
        allocatedMinutes: 0,
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    let currentExamCount = timelineDays.filter((d) => d.isExam).length;
    let currentHackathonCount = timelineDays.filter((d) => d.isHackathon).length;
    let currentSlackCount = timelineDays.filter((d) => d.isSlack).length;

    timelineDays.forEach((day, idx) => {
      if (day.availableCapacity > 0) {
        if (day.isWeekend && currentHackathonCount < reservedHackathonDaysCount && Math.floor(idx / 7) % 3 === 2) {
          day.isHackathon = true;
          day.availableCapacity = 0;
          currentHackathonCount++;
        } else if (currentSlackCount < reservedSlackDaysCount && (idx % 10 === 4 || idx % 10 === 9)) {
          day.isSlack = true;
          day.availableCapacity = 0;
          currentSlackCount++;
        } else if (currentExamCount < reservedExamDaysCount && (idx % 10 === 2 || idx % 10 === 7)) {
          day.isExam = true;
          day.availableCapacity = 0;
          currentExamCount++;
        }
      }
    });

    const effectiveStudyDays = timelineDays.filter((d) => d.availableCapacity > 0);
    const totalAvailableStudyMinutes = effectiveStudyDays.reduce(
      (sum, d) => sum + d.availableCapacity,
      0,
    );

    const uncompletedActivities = activities
      .filter((a) => a.status !== 'completed')
      .sort((a, b) => {
        const secA = Number(a.sectionNumber) || 0;
        const secB = Number(b.sectionNumber) || 0;
        if (secA !== secB) return secA - secB;
        return (Number(a.activityNumber) || 0) - (Number(b.activityNumber) || 0);
      });

    const totalRemainingMinutes = uncompletedActivities.reduce(
      (sum, a) => sum + (a.remainingMinutes || a.totalEffortMinutes || 45),
      0,
    );
    const totalContentMinutes = uncompletedActivities.reduce(
      (sum, a) => sum + (a.contentDurationMinutes || 30),
      0,
    );

    const isNarrowBudget = totalRemainingMinutes > totalAvailableStudyMinutes;
    const deficitMinutes = Math.max(0, totalRemainingMinutes - totalAvailableStudyMinutes);
    const recommendedMultiplier =
      totalContentMinutes > 0
        ? Math.max(
            1.0,
            Math.round((totalAvailableStudyMinutes / totalContentMinutes) * 10) / 10,
          )
        : 1.8;

    let pacingCoaching = null;
    if (isNarrowBudget) {
      pacingCoaching = {
        isFeasible: false,
        type: 'narrow_budget',
        deficitMinutes,
        deficitHours: Math.round((deficitMinutes / 60) * 10) / 10,
        recommendedMultiplier,
        message: `Action Required: Pacing Overload. At your current practice multiplier, remaining course effort (${Math.round(totalRemainingMinutes / 60)}h) exceeds effective study capacity (${Math.round(totalAvailableStudyMinutes / 60)}h) before ${targetDate}.`,
        actionableAdvice: `Recommendation: Adjust your practice multiplier to ${recommendedMultiplier}x, or add a 30m weekend focus block to complete comfortably by ${targetDate}.`,
      };
    } else {
      const surplusHours = Math.round(((totalAvailableStudyMinutes - totalRemainingMinutes) / 60) * 10) / 10;
      pacingCoaching = {
        isFeasible: true,
        type: 'on_track',
        surplusHours,
        recommendedMultiplier: null,
        message: `Your schedule is comfortably feasible! You have ${surplusHours}h of buffer capacity before ${targetDate}.`,
        actionableAdvice: `Stick to your normal weekday and weekend timetable blocks. If you study on holidays, you will finish even earlier!`,
      };
    }

    let actIndex = 0;
    const allocations = [];

    for (const day of effectiveStudyDays) {
      if (actIndex >= uncompletedActivities.length) break;

      let remainingDayMinutes = day.availableCapacity;

      while (actIndex < uncompletedActivities.length && remainingDayMinutes >= minCoherentMinutes) {
        const act = uncompletedActivities[actIndex];
        const effort = act.remainingMinutes || act.totalEffortMinutes || 45;

        if (effort <= remainingDayMinutes) {
          day.allocatedActivities.push({
            activityId: act._id || act.id,
            title: act.title,
            sectionNumber: act.sectionNumber,
            activityNumber: act.activityNumber,
            allocatedMinutes: effort,
          });
          day.allocatedMinutes += effort;
          remainingDayMinutes -= effort;

          allocations.push({
            activityId: (act._id || act.id).toString(),
            scheduledDate: day.date,
            allocatedMinutes: effort,
          });
          actIndex++;
        } else if (
          remainingDayMinutes >= minCoherentMinutes &&
          effort - remainingDayMinutes <= Math.max(10, remainingDayMinutes * 0.2)
        ) {
          day.allocatedActivities.push({
            activityId: act._id || act.id,
            title: act.title,
            sectionNumber: act.sectionNumber,
            activityNumber: act.activityNumber,
            allocatedMinutes: effort,
            note: 'Coherent boundary completion',
          });
          day.allocatedMinutes += effort;
          allocations.push({
            activityId: (act._id || act.id).toString(),
            scheduledDate: day.date,
            allocatedMinutes: effort,
          });
          actIndex++;
          remainingDayMinutes = 0;
          break;
        } else {
          break;
        }
      }
    }

    const unplacedCount = uncompletedActivities.length - actIndex;

    return {
      startDate,
      targetDate,
      daySpan,
      effectiveStudyDaysCount: effectiveStudyDays.length,
      reserves: {
        examDays: currentExamCount,
        hackathonDays: currentHackathonCount,
        slackDays: currentSlackCount,
      },
      capacity: {
        totalAvailableStudyMinutes,
        totalRemainingMinutes,
        totalContentMinutes,
      },
      pacingCoaching,
      allocations,
      unplacedCount,
      timeline: timelineDays.map((d) => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        isWeekend: d.isWeekend,
        isExam: d.isExam,
        isHackathon: d.isHackathon,
        isSlack: d.isSlack,
        availableCapacity: d.availableCapacity,
        allocatedActivitiesCount: d.allocatedActivities.length,
        allocatedMinutes: d.allocatedMinutes,
      })),
    };
  }
}
