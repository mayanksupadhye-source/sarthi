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

import { normalizeBlockType, resolveBlockFlexible } from "../models/ScheduleTemplate.js";

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
        reasons.push(`Slack Day activated. Non-critical tasks deferred to protect recovery buffer while maintaining core streak.`);
        // Slack day is a lighter, flexible execution day (not a 0-capacity wasteland).
        // Essential P1 tasks and daily reading streak remain active.
        const tasksToDefer = [];
        const tasksToRetain = [];
        const allCandidates = [...existingScheduledTasks, ...missedOrUnfinishedTasks];

        for (const t of allCandidates) {
          const priority = (t.priority || '').toUpperCase();
          if (priority === 'P1' || t.isProtected || t.category === 'reading') {
            tasksToRetain.push(t);
          } else {
            tasksToDefer.push(t);
            changes.push({
              taskId: t._id || t.id,
              title: t.title,
              action: 'defer_slack_day',
              originalDate: targetDate,
              newDate: null,
              reason: 'Deferred to protect Slack Day recovery buffer'
            });
          }
        }

        const slackCapacity = 90; // Light 90-minute intentional buffer window
        const allocatedMinutes = tasksToRetain.reduce((sum, t) => sum + PlannerEngine.getRemainingEffort(t), 0);

        return {
          targetDate,
          isSlackDay: true,
          capacityMinutes: slackCapacity,
          allocatedMinutes,
          acceptedTasks: tasksToRetain.map(t => ({
            ...t,
            remainingMinutes: PlannerEngine.getRemainingEffort(t),
            priorityReason: 'Essential P1 / streak retained during Slack Day'
          })),
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
  /**
   * PURE ALLOCATION FUNCTION (No DB calls, no Date.now(), 100% deterministic)
   * 
   * @param {Object} inputs
   * @param {Array} inputs.courses - Course objects with slug, title, category, priority, defaultPracticeMultiplier, startDate, targetDate, lectures
   * @param {Array} [inputs.progressLogs=[]] - Append-only minute logs [{ courseSlug, date, minutesSpent, type }]
   * @param {Object} [inputs.completedLectures={}] - Map of courseSlug -> Set of completed lecture numbers
   * @param {Function|Object} inputs.timetablePerDate - (dateStr) => { dayType, blocks: [...] } or object map
   * @param {Object} [inputs.specialDates={}] - { examDates: Set, hackathonDates: Set, slackDates: Set }
   * @param {Object} [inputs.settings={}] - { fallbackHubEffortMinutes: 150, fallbackExplorationEffortMinutes: 45, availabilityBufferRatio: 0.25, dailyMaxWorkMinutes: 480 }
   * @param {string} inputs.today - YYYY-MM-DD date in Asia/Kolkata
   * @param {number} [inputs.horizonDays=150] - Number of days to plan forward
   * @returns {Object} { dayPlans: Array<Object>, feasibility: Object, slackProposal: Object }
   */
  static allocate({
    courses = [],
    progressLogs = [],
    completedLectures = {},
    timetablePerDate,
    specialDates = {},
    settings = {},
    today,
    horizonDays = 150,
  }) {
    if (!today || typeof today !== "string") {
      throw new Error("allocate requires today as a YYYY-MM-DD string.");
    }

    const fallbackHub = Number(settings.fallbackHubEffortMinutes) || 150;
    const fallbackExp = Number(settings.fallbackExplorationEffortMinutes) || 45;
    const bufferRatio = settings.availabilityBufferRatio !== undefined ? Number(settings.availabilityBufferRatio) : 0.25;
    const dailyMax = Number(settings.dailyMaxWorkMinutes) || 480;

    const examDates = specialDates.examDates instanceof Set ? specialDates.examDates : new Set(specialDates.examDates || []);
    const hackathonDates = specialDates.hackathonDates instanceof Set ? specialDates.hackathonDates : new Set(specialDates.hackathonDates || []);
    const slackDates = specialDates.slackDates instanceof Set ? specialDates.slackDates : new Set(specialDates.slackDates || []);

    // Resolve timetable lookup function
    const getTimetableForDate = (dateStr) => {
      if (typeof timetablePerDate === "function") {
        return timetablePerDate(dateStr) || { dayType: "weekday", blocks: [] };
      }
      if (timetablePerDate && typeof timetablePerDate === "object") {
        if (timetablePerDate[dateStr]) return timetablePerDate[dateStr];
        const [y, m, d] = dateStr.split("-").map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const key = dow === 0 ? "sunday" : dow === 6 ? "saturday" : "weekday";
        return timetablePerDate[key] || { dayType: key, blocks: [] };
      }
      return { dayType: "weekday", blocks: [] };
    };

    // Pre-calculate which courses have blocks in any active template, and specifically in standard (weekday/sat/sun) templates
    const coursesWithTemplateBlocks = new Set();
    const coursesWithStandardBlocks = new Set();
    const extractBlocks = (blocks, targetSet) => {
      if (!Array.isArray(blocks)) return;
      blocks.forEach((b) => {
        if (b.courseSlug) targetSet.add(b.courseSlug);
        if (b.category) targetSet.add(b.category);
        courses.forEach((c) => {
          const slugNorm = (c.slug || "").toLowerCase().replace(/[-_]/g, " ");
          const bText = `${b.label || ""} ${b.category || ""}`.toLowerCase();
          if (bText.includes(slugNorm) || (c.slug.includes("typing") && bText.includes("typing"))) {
            targetSet.add(c.slug);
          }
        });
      });
    };

    if (typeof timetablePerDate === "function") {
      const [startYear, startMonth, startDay] = today.split("-").map(Number);
      let scanDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      for (let i = 0; i < Math.min(horizonDays, 30); i++) {
        const dStr = scanDate.toISOString().slice(0, 10);
        const tmpl = getTimetableForDate(dStr);
        extractBlocks(tmpl?.blocks, coursesWithTemplateBlocks);
        if (["weekday", "saturday", "sunday"].includes(tmpl?.dayType)) {
          extractBlocks(tmpl?.blocks, coursesWithStandardBlocks);
        }
        scanDate.setUTCDate(scanDate.getUTCDate() + 1);
      }
    } else if (timetablePerDate && typeof timetablePerDate === "object") {
      Object.entries(timetablePerDate).forEach(([key, tmpl]) => {
        extractBlocks(tmpl?.blocks, coursesWithTemplateBlocks);
        if (["weekday", "saturday", "sunday"].includes(key)) {
          extractBlocks(tmpl?.blocks, coursesWithStandardBlocks);
        }
      });
    }

    // Normalize courses and their sequential lecture definitions
    const normalizedCourses = courses.map((c) => {
      const slug = c.slug || c.id || "course";
      const multiplier = Number(c.defaultPracticeMultiplier) || Number(c.multiplier) || 2.0;
      let lecs = [];

      if (Array.isArray(c.lectures) && c.lectures.length > 0) {
        lecs = c.lectures.map((l, idx) => ({
          lectureNumber: l.lectureNumber || idx + 1,
          title: l.title || `Lecture ${idx + 1}`,
          videoDurationMinutes: Number(l.videoDurationMinutes) || Number(l.contentDurationMinutes) || 30,
          totalEffortMinutes: Number(l.totalEffortMinutes) || Math.round((Number(l.videoDurationMinutes) || 30) * multiplier),
          isCompleted: Boolean(l.isCompleted),
        }));
      } else if (Array.isArray(c.sections) && c.sections.length > 0) {
        let lNum = 1;
        for (const sec of c.sections) {
          if (Array.isArray(sec.lectures)) {
            for (const l of sec.lectures) {
              lecs.push({
                lectureNumber: l.lectureNumber || lNum++,
                title: l.title || `Lecture ${l.lectureNumber || lNum}`,
                videoDurationMinutes: Number(l.videoDurationMinutes) || 30,
                totalEffortMinutes: Number(l.totalEffortMinutes) || Math.round((Number(l.videoDurationMinutes) || 30) * multiplier),
                isCompleted: Boolean(l.isCompleted),
              });
            }
          }
        }
      }

      // If course has totalHours or totalLectures but no discrete list, synthesize standard lectures
      if (lecs.length === 0) {
        const totalLecs = Number(c.totalLectures) || Math.max(5, Math.ceil((Number(c.totalHours) || 10) * 1.5));
        const totalMins = Number(c.totalMinutes) || Math.round((Number(c.totalHours) || 10) * 60);
        const minsPerLec = Math.max(15, Math.round(totalMins / totalLecs / multiplier));
        for (let i = 1; i <= totalLecs; i++) {
          lecs.push({
            lectureNumber: i,
            title: `Lecture ${i}`,
            videoDurationMinutes: minsPerLec,
            totalEffortMinutes: Math.round(minsPerLec * multiplier),
            isCompleted: false,
          });
        }
      }

      // Track completed lecture flags
      const doneSet = completedLectures[slug] instanceof Set
        ? completedLectures[slug]
        : new Set(Array.isArray(completedLectures[slug]) ? completedLectures[slug] : []);

      lecs.forEach((l) => {
        if (doneSet.has(l.lectureNumber)) l.isCompleted = true;
      });

      return {
        ...c,
        slug,
        multiplier,
        lectures: lecs,
        totalVideoMinutes: lecs.reduce((s, l) => s + l.videoDurationMinutes, 0),
        totalEffortMinutes: lecs.reduce((s, l) => s + l.totalEffortMinutes, 0),
      };
    });

    // Helper: Find position in lecture sequence given consumed video minutes
    const formatLecturePos = (lectures, consumedVideoMins) => {
      let remaining = Math.max(0, consumedVideoMins);
      for (let i = 0; i < lectures.length; i++) {
        const l = lectures[i];
        if (remaining < l.videoDurationMinutes) {
          const m = Math.floor(remaining);
          const s = Math.round((remaining - m) * 60);
          const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
          return {
            lectureNumber: l.lectureNumber,
            lectureIndex: i,
            minuteOffset: remaining,
            positionStr: `Lecture ${l.lectureNumber} (${timeStr})`,
            formatted: `up to Lecture ${l.lectureNumber}, ${timeStr}`,
            isFinished: false,
          };
        }
        remaining -= l.videoDurationMinutes;
      }
      const lastL = lectures[lectures.length - 1];
      return {
        lectureNumber: lastL ? lastL.lectureNumber : 1,
        lectureIndex: lectures.length,
        minuteOffset: lastL ? lastL.videoDurationMinutes : 0,
        positionStr: `Lecture ${lastL ? lastL.lectureNumber : 1} (Completed)`,
        formatted: `Course Complete (All ${lectures.length} lectures finished)`,
        isFinished: true,
      };
    };

    // Calculate initial starting progress per course up to today
    const courseState = new Map();
    normalizedCourses.forEach((c) => {
      const courseLogs = progressLogs.filter((p) => p.courseSlug === c.slug && p.date && p.date < today);
      const pastLoggedEffort = courseLogs.reduce((s, p) => s + (Number(p.minutesSpent) || 0), 0);
      let consumedVideo = pastLoggedEffort / c.multiplier;

      // Completed flags also advance position
      c.lectures.forEach((l) => {
        if (l.isCompleted) {
          consumedVideo = Math.max(consumedVideo, (l.lectureNumber * l.videoDurationMinutes));
        }
      });

      // Calculate carryover from yesterday if yesterday had an unfulfilled target
      const [y, m, d] = today.split("-").map(Number);
      const yesterdayStr = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
      const yesterdayLog = progressLogs.filter((p) => p.courseSlug === c.slug && p.date === yesterdayStr);
      const yesterdayActual = yesterdayLog.reduce((s, p) => s + (Number(p.minutesSpent) || 0), 0);

      let yesterdayTarget = 0;
      if (progressLogs.length > 0 && (yesterdayLog.length > 0 || (c.startDate && yesterdayStr >= c.startDate))) {
        const yesterdayTmpl = getTimetableForDate(yesterdayStr);
        const yBlocks = (yesterdayTmpl.blocks || []).filter((b) => b.courseSlug === c.slug);
        if (yBlocks.length > 0) {
          yesterdayTarget = yBlocks.reduce((sum, b) => sum + (Number(b.durationMinutes) || 0), 0);
        } else if (!coursesWithTemplateBlocks.has(c.slug)) {
          yesterdayTarget = c.category === "exploration"
            ? fallbackExp
            : fallbackHub;
        }
      }

      const carryoverEffort = (yesterdayTarget > 0 && yesterdayActual < yesterdayTarget)
        ? Math.max(0, yesterdayTarget - yesterdayActual)
        : 0;

      courseState.set(c.slug, {
        startingConsumedVideo: consumedVideo,
        consumedVideoMinutes: consumedVideo,
        carryoverEffortMinutes: carryoverEffort,
        consecutiveMisses: 0,
        lastPlannedDate: null,
      });
    });

    // Check recent misses for slack evaluation:
    // A course triggers slack proposal ONLY when it had scheduled blocks and missed 3 consecutive sessions
    const recentMissesByCourse = new Map();
    normalizedCourses.forEach((c) => {
      let consecutiveMisses = 0;
      for (let i = 1; i <= 3; i++) {
        const [y, m, d] = today.split("-").map(Number);
        const pastDate = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10);
        if (c.startDate && pastDate < c.startDate && !progressLogs.some((p) => p.courseSlug === c.slug && p.date === pastDate)) break;

        const pastTmpl = getTimetableForDate(pastDate);
        const hadBlock = (pastTmpl.blocks || []).some((b) => b.courseSlug === c.slug);
        if (!hadBlock && coursesWithTemplateBlocks.has(c.slug)) {
          continue; // Not scheduled on this day
        }

        const dayLogs = progressLogs.filter((p) => p.courseSlug === c.slug && p.date === pastDate);
        const actual = dayLogs.reduce((s, p) => s + (Number(p.minutesSpent) || 0), 0);
        if (actual === 0) {
          // Check if this date was an active working day (user logged something or had scheduled blocks)
          const hadAnyLogs = progressLogs.some((p) => p.date === pastDate);
          if (hadAnyLogs || progressLogs.length === 0) {
            consecutiveMisses++;
          }
        } else {
          // Session was fulfilled, break consecutive miss streak
          break;
        }
      }
      if (consecutiveMisses >= 3) {
        recentMissesByCourse.set(c.slug, consecutiveMisses);
      }
    });

    // Project days forward
    const dayPlans = [];
    const [startYear, startMonth, startDay] = today.split("-").map(Number);
    let curUtc = new Date(Date.UTC(startYear, startMonth - 1, startDay));

    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
      const dateStr = curUtc.toISOString().slice(0, 10);
      const dayOfWeek = curUtc.getUTCDay(); // 0 = Sun, 6 = Sat
      const isExam = examDates.has(dateStr);
      const isHackathon = hackathonDates.has(dateStr);
      const isSlack = slackDates.has(dateStr);

      const timetable = getTimetableForDate(dateStr);
      const isExamProfile = timetable.dayType === "exam" || timetable.activeProfile === "exam" || isExam;

      const dayPlan = {
        date: dateStr,
        dayType: timetable.dayType || (dayOfWeek === 0 ? "sunday" : dayOfWeek === 6 ? "saturday" : "weekday"),
        activeProfile: timetable.activeProfile || timetable.dayType || (dayOfWeek === 0 ? "sunday" : dayOfWeek === 6 ? "saturday" : "weekday"),
        isConfirmedSchedule: Boolean(timetable.isConfirmedSchedule),
        scheduleSource: timetable.scheduleSource || (timetable.isConfirmedSchedule ? "activation" : "assumed-default"),
        isExamDay: Boolean(isExam || isExamProfile),
        isHackathon: Boolean(isHackathon),
        isSlackDay: Boolean(isSlack),
        targetCapacityMinutes: 0,
        allocatedMinutes: 0,
        coursePlans: [],
        overflowSuggestions: [],
      };

      if (!isHackathon) {
        for (const c of normalizedCourses) {
          // Check date constraints: must be >= startDate and <= (endDate || targetDate)
          if (c.startDate && dateStr < c.startDate) continue;
          const courseEndDate = c.endDate || c.targetDate;
          if (courseEndDate && dateStr > courseEndDate) continue;

          const state = courseState.get(c.slug);
          if (!state) continue;

          // Check if course already finished all lectures
          const currentPos = formatLecturePos(c.lectures, state.consumedVideoMinutes);
          if (currentPos.isFinished) continue;

          // Find matching blocks in today's active profile (skip fixed night_routine, checklist, rest)
          const slugNorm = c.slug.toLowerCase().replace(/[-_]/g, " ");
          const matchingBlocks = (timetable.blocks || []).filter((b) => {
            const bType = normalizeBlockType(b);
            if (["night_routine", "checklist", "rest"].includes(bType) && b.category !== "oratory") {
              return false;
            }
            const bText = `${b.label || ""} ${b.category || ""} ${b.courseSlug || ""}`.toLowerCase();
            return (
              b.courseSlug === c.slug ||
              b.category === c.slug ||
              bText.includes(slugNorm) ||
              (c.slug.includes("typing") && bText.includes("typing")) ||
              (c.slug.includes("dsa") && bText.includes("dsa")) ||
              (c.slug.includes("web") && bText.includes("web")) ||
              (c.category === "exploration" && !b.courseSlug && b.category === "exploration") ||
              (c.category === "oratory" && (b.category === "oratory" || bText.includes("oratory") || bText.includes("speech")))
            );
          });

          const isExploration = c.category === "exploration" || c.slug.includes("typing");
          let dailyCapacity = matchingBlocks.reduce((s, b) => s + (b.durationMinutes || 0), 0);
          let source = "timetable";

          if (isExamProfile) {
            dailyCapacity = 0;
          } else if (dailyCapacity === 0 && !isSlack) {
            const isManualRange = Boolean(timetable.scheduleSource === "activation" || timetable.isConfirmedSchedule);
            const isWeekend = timetable.dayType === "saturday" || timetable.dayType === "sunday";
            const isAssumedWeekday = !isManualRange && !isWeekend && timetable.dayType === "weekday";

            if (isWeekend || isManualRange) {
              // User rule: Weekend timetable and manual ranges will NOT change on an assumption basis.
              dailyCapacity = 0;
            } else if (isAssumedWeekday && isExploration && !coursesWithStandardBlocks.has(c.slug)) {
              // User rule: On assumed normal weekdays (Mon-Fri), assume 45m/day for active explorations
              // that don't have a dedicated weekday/weekend block (except Saturday & Sunday remain unchanged).
              dailyCapacity = fallbackExp || 45;
              source = coursesWithTemplateBlocks.has(c.slug)
                ? "default-assumption"
                : "Not in your timetable yet, add a block";
            } else {
              // Check if course has blocks in any template or activation profile
              const hasAssignedBlocks = coursesWithTemplateBlocks.has(c.slug) || (timetable.blocks && timetable.blocks.some(b => b.courseSlug === c.slug));
              if (!hasAssignedBlocks) {
                // The fallback (150 Hub / 45 Exploration) applies ONLY to a course with ZERO blocks in every template and activation profile.
                // Label it "Not in your timetable yet, add a block" and nothing more.
                const isHub = !isExploration && (c.category === "course" || ["dsa", "web-dev", "core"].includes(c.category));
                dailyCapacity = isHub ? fallbackHub : fallbackExp;
                source = "Not in your timetable yet, add a block";
              } else {
                // Course has dedicated blocks on other days, but NONE on today's active profile -> ABSENT (0 capacity)
                dailyCapacity = 0;
              }
            }
          }

          if (isSlack && dailyCapacity > 0) {
            // Slack Day: protected activities retain full allocation; eligible non-protected core courses are lightened by ~50%;
            // flexible P3 explorations and remaining unprotected work are deferred to recovery.
            if (c.isProtected) {
              // Retain full protected allocation
            } else if (!isExploration && (c.category === "course" || c.priority === "P1")) {
              dailyCapacity = Math.max(30, Math.round(dailyCapacity * 0.5));
            } else {
              dailyCapacity = 0;
            }
          }

          if (dailyCapacity > 0) {
            const totalCarryover = state.carryoverEffortMinutes || 0;
            // Catch-Up Priority Step 1: Carryover stays in its OWN block first, capped at block capacity
            const ownCarryover = Math.min(totalCarryover, dailyCapacity);
            const overflowExcess = Math.max(0, totalCarryover - dailyCapacity);

            // Catch-Up Priority Step 2: ONLY if own block cannot absorb within cap, suggest a Flexible block on THIS date's timetable
            if (overflowExcess > 0) {
              const flexBlock = (timetable.blocks || []).find(
                (b) => b.courseSlug !== c.slug && resolveBlockFlexible(b) === true
              );
              if (flexBlock) {
                dayPlan.overflowSuggestions.push({
                  fromCourseSlug: c.slug,
                  fromCourseTitle: c.title,
                  overflowMinutes: overflowExcess,
                  targetBlockId: flexBlock.blockId,
                  targetBlockLabel: flexBlock.label,
                  targetBlockMinutes: flexBlock.durationMinutes,
                  requiresConfirmation: true,
                  reason: `${c.title} has ${totalCarryover}m unfinished work, exceeding its ${dailyCapacity}m block cap by ${overflowExcess}m. You can use "${flexBlock.label}" (${flexBlock.durationMinutes}m, Flexible) today if you confirm.`,
                });
              }
            }

            // Total target NEVER exceeds capacity. First ownCarryover is dedicated to yesterday's material.
            const effortTarget = dailyCapacity;
            const lectureMinTarget = Math.round(effortTarget / c.multiplier);

            const startPosStr = currentPos.positionStr;
            const nextVideoConsumed = state.consumedVideoMinutes + lectureMinTarget;
            const endPos = formatLecturePos(c.lectures, nextVideoConsumed);

            // Compute exact per-lecture breakdown (lecture names + minutes covered today)
            const lectureBreakdown = [];
            let lecCursor = 0;
            for (const lec of c.lectures) {
              const lecStart = lecCursor;
              const lecEnd = lecCursor + lec.videoDurationMinutes;
              const overlapStart = Math.max(state.consumedVideoMinutes, lecStart);
              const overlapEnd = Math.min(nextVideoConsumed, lecEnd);
              if (overlapEnd > overlapStart + 0.01) {
                const vMin = Math.round(overlapEnd - overlapStart);
                if (vMin > 0) {
                  lectureBreakdown.push({
                    lectureNumber: lec.lectureNumber,
                    title: lec.title || `Lecture ${lec.lectureNumber}`,
                    videoMinutes: vMin,
                    effortMinutes: Math.round(vMin * c.multiplier),
                  });
                }
              }
              lecCursor = lecEnd;
              if (lecCursor >= nextVideoConsumed) break;
            }

            dayPlan.coursePlans.push({
              courseId: c._id || c.id,
              courseSlug: c.slug,
              courseTitle: c.title,
              category: c.category || "course",
              priority: c.priority || "P2",
              lectureMinTarget,
              effortMinTarget: effortTarget,
              carryoverMin: ownCarryover,
              overflowPendingMin: overflowExcess,
              minAcceptableMarkMin: Math.round(effortTarget * 0.75),
              startPosition: startPosStr,
              endPosition: endPos.positionStr,
              endPositionLabel: endPos.formatted,
              startLectureNumber: currentPos.lectureNumber,
              endLectureNumber: endPos.lectureNumber,
              lectureBreakdown,
              source,
              status: "planned",
              actualMinutes: 0,
            });

            dayPlan.allocatedMinutes += effortTarget;
            state.consumedVideoMinutes = nextVideoConsumed;
            state.carryoverEffortMinutes = overflowExcess; // Any excess beyond today's cap spreads to subsequent days unless user confirms overflow
          }
        }
      }

      dayPlans.push(dayPlan);
      curUtc.setUTCDate(curUtc.getUTCDate() + 1);
    }

    // Feasibility Calculation per Course with Fixed Exam Mode Budget (Hard max 14)
    const semesterExamBudget = Math.min(14, Math.max(1, Number(settings.semesterExamDaysBudget) || 14));
    const scheduledExamDays = dayPlans.filter(dp => dp.isExamDay).length;
    const unplacedExamDays = Math.max(0, semesterExamBudget - scheduledExamDays);

    const feasibility = {};
    normalizedCourses.forEach((c) => {
      // Starting remaining video BEFORE projecting future days (reconciles progressLogs and checkbox isCompleted flags)
      const startingConsumed = courseState.get(c.slug)?.startingConsumedVideo || 0;
      const startingRemainingVideo = Math.max(0, c.totalVideoMinutes - startingConsumed);
      const totalEffortNeeded = Math.round(startingRemainingVideo * c.multiplier);

      // Count usable capacity on planned days before targetDate / endDate
      const courseTarget = c.targetDate || c.endDate;
      let usableEffortCapacity = 0;
      let usableDaysCount = 0;

      for (const dp of dayPlans) {
        if (courseTarget && dp.date > courseTarget) break;
        if (dp.isExamDay || dp.isHackathon) continue;

        const cp = dp.coursePlans.find((p) => p.courseSlug === c.slug);
        if (cp && cp.effortMinTarget > 0) {
          usableEffortCapacity += cp.effortMinTarget;
          usableDaysCount++;
        }
      }

      // Reserve capacity for unplaced exam days so distribution does not overpromise
      const effectiveDays = Math.max(0, usableDaysCount - unplacedExamDays);
      const avgDailyCap = usableDaysCount > 0 ? (usableEffortCapacity / usableDaysCount) : 0;
      const effectiveCapacity = Math.round(effectiveDays * avgDailyCap);

      // Apply real-life buffer (25% default)
      const discountedCapacity = Math.round(effectiveCapacity * (1 - bufferRatio));
      const isFeasible = totalEffortNeeded <= discountedCapacity || totalEffortNeeded === 0;
      const shortfallMinutes = Math.max(0, totalEffortNeeded - discountedCapacity);

      feasibility[c.slug] = {
        courseTitle: c.title,
        multiplier: c.multiplier,
        totalEffortNeededMinutes: totalEffortNeeded,
        usableCapacityMinutes: effectiveCapacity,
        bufferedCapacityMinutes: discountedCapacity,
        isFeasible,
        shortfallMinutes,
        suggestedFeasibleMultiplier: startingRemainingVideo > 0
          ? Math.max(1.0, Math.round((discountedCapacity / startingRemainingVideo) * 10) / 10)
          : 1.0,
        suggestedDailyMinutes: effectiveDays > 0
          ? Math.ceil(totalEffortNeeded / effectiveDays)
          : 120,
        suggestedExtendedDays: avgDailyCap > 0 && shortfallMinutes > 0
          ? Math.ceil(shortfallMinutes / (avgDailyCap * (1 - bufferRatio)))
          : 0,
      };
    });

    // Slack proposal evaluation
    const slackProposal = {
      proposed: false,
      reason: "",
      affectedCourses: [],
    };

    normalizedCourses.forEach((c) => {
      const misses = recentMissesByCourse.get(c.slug) || 0;
      if (misses >= 3) {
        slackProposal.proposed = true;
        slackProposal.reason = `${c.title} has 3 consecutive missed targets. Daily catch-up would exceed safe working capacity. Recommend taking a scheduled slack day to reset buffer without cognitive penalty.`;
        slackProposal.affectedCourses.push(c.slug);
      }
    });

    return {
      dayPlans,
      feasibility,
      slackProposal,
    };
  }

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

      // Match candidate courses:
      // 1. Exact match on targetSlug
      // 2. Partial match (e.g. block mentions "typing" -> matches "typing-practice", "touch-typing", etc.)
      // 3. Category match (block category 'exploration' matches all exploration courses)
      let candidateSlugs = [];
      const blockText = `${block.label || ''} ${block.category || ''} ${block.courseSlug || ''}`.toLowerCase();

      if (targetSlug && courseActivities.has(targetSlug)) {
        candidateSlugs.push(targetSlug);
      }

      // Check matching by course title or keywords in block text
      for (const slug of courseActivities.keys()) {
        if (!candidateSlugs.includes(slug)) {
          const slugNorm = slug.toLowerCase().replace(/[-_]/g, ' ');
          if (
            (block.courseSlug && block.courseSlug === slug) ||
            blockText.includes(slugNorm) ||
            (blockText.includes('typing') && slug.includes('typing')) ||
            (blockText.includes('web') && slug.includes('web')) ||
            (blockText.includes('dsa') && slug.includes('dsa')) ||
            (block.category === 'exploration' && slug.includes('exp')) ||
            (block.category === 'oratory' && slug.includes('oratory'))
          ) {
            candidateSlugs.push(slug);
          }
        }
      }

      if (candidateSlugs.length === 0) {
        if (!targetSlug) {
          candidateSlugs = Array.from(courseActivities.keys());
        }
      }

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
              courseSlug: act.courseSlug || slug,
              sectionNumber: act.sectionNumber,
              sectionTitle: act.sectionTitle,
              activityNumber: act.activityNumber,
              title: act.title,
              allocatedMinutes: effort,
              status: act.status || 'pending',
              isManualSession: Boolean(act.isManualSession)
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
              courseSlug: act.courseSlug || slug,
              sectionNumber: act.sectionNumber,
              sectionTitle: act.sectionTitle,
              activityNumber: act.activityNumber,
              title: act.title,
              allocatedMinutes: effort,
              status: act.status || 'pending',
              isManualSession: Boolean(act.isManualSession),
              note: 'Allocated with coherent section boundary completion'
            });
            allocatedActivityIds.add(actId);
            allocatedActivities.push(act);
            totalAllocatedMinutes += effort;
            remainingBlockMinutes = 0;
            break;
          } else {
            // Cannot fit activity into remaining block window
            break;
          }

          if (remainingBlockMinutes <= 0) {
            break;
          }
        }

        if (remainingBlockMinutes <= 0) {
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
    course,
    activities = [],
    weekdayBlocks = [],
    weekendBlocks = [],
    saturdayBlocks = [],
    sundayBlocks = [],
    dedicatedMinutesPerDay = null,
    dailyStudyMinutes = null,
    knownExams = [],
    knownHackathons = [],
    knownSlackDays = [],
    minCoherentMinutes = 15,
  }) {
    const effectiveStartDate = startDate || course?.startDate;
    const effectiveTargetDate = targetDate || course?.targetDate;
    const effectiveSlug = courseSlug || course?.slug;
    const effectiveDedicatedMinutes = dedicatedMinutesPerDay !== null && dedicatedMinutesPerDay !== undefined
      ? Number(dedicatedMinutesPerDay)
      : (dailyStudyMinutes !== null && dailyStudyMinutes !== undefined ? Number(dailyStudyMinutes) : null);

    const startDt = new Date(effectiveStartDate);
    const targetDt = new Date(effectiveTargetDate);
    const daySpan = Math.max(1, Math.round((targetDt - startDt) / (1000 * 60 * 60 * 24)) + 1);

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
    const monthSpan = Math.max(1, daySpan / 30);
    const reservedExamDaysCount = Math.min(15, Math.max(2, Math.round(monthSpan * 3)));
    const reservedHackathonDaysCount = Math.min(12, Math.max(1, Math.round(monthSpan * 2.2)));
    const reservedSlackDaysCount = Math.min(15, Math.max(2, Math.round(monthSpan * 2.5)));

    for (let i = 0; i < daySpan; i++) {
      const dateStr = curDate.toISOString().slice(0, 10);
      const dayOfWeek = curDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const isExam = examDateSet.has(dateStr);
      const isHackathon = hackathonDateSet.has(dateStr);
      const isSlack = slackDateSet.has(dateStr);

      // Determine day's specific template blocks
      let templateBlocks = weekdayBlocks;
      if (dayOfWeek === 0) {
        templateBlocks = sundayBlocks && sundayBlocks.length > 0 ? sundayBlocks : weekendBlocks;
      } else if (dayOfWeek === 6) {
        templateBlocks = saturdayBlocks && saturdayBlocks.length > 0 ? saturdayBlocks : weekendBlocks;
      }

      let dayStudyCapacity = 0;

      if (effectiveDedicatedMinutes && effectiveDedicatedMinutes > 0) {
        dayStudyCapacity = effectiveDedicatedMinutes;
      } else if (templateBlocks && templateBlocks.length > 0) {
        const slugNorm = (effectiveSlug || '').toLowerCase().replace(/[-_]/g, ' ');
        // 1. Prioritize blocks specifically dedicated to this course or category
        const specificBlocks = templateBlocks.filter(
          (b) =>
            (effectiveSlug && b.courseSlug === effectiveSlug) ||
            (b.label && slugNorm && b.label.toLowerCase().includes(slugNorm)) ||
            (effectiveSlug && effectiveSlug.includes('typing') && b.label && b.label.toLowerCase().includes('typing')) ||
            (effectiveSlug && effectiveSlug.includes('web') && b.label && b.label.toLowerCase().includes('web')) ||
            (effectiveSlug && effectiveSlug.includes('dsa') && b.label && b.label.toLowerCase().includes('dsa')),
        );
        if (specificBlocks.length > 0) {
          dayStudyCapacity = specificBlocks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
        } else {
          // 2. Fall back to general study/exploration blocks
          const matchingBlocks = templateBlocks.filter(
            (b) =>
              b.category === effectiveSlug ||
              ['study', 'webdev', 'dsa', 'oratory', 'exploration'].includes(b.category) ||
              b.blockType === 'learning' ||
              b.blockType === 'exploration',
          );
          dayStudyCapacity = matchingBlocks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
        }
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
        availableCapacity: isExam || isHackathon ? 0 : isSlack ? Math.min(dayStudyCapacity, 60) : dayStudyCapacity,
        standardCapacity: dayStudyCapacity,
        allocatedActivities: [],
        allocatedMinutes: 0,
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    let currentExamCount = timelineDays.filter((d) => d.isExam).length;
    let currentHackathonCount = timelineDays.filter((d) => d.isHackathon).length;
    let currentSlackCount = timelineDays.filter((d) => d.isSlack).length;

    // Apply known or simulated semester buffers when explicit lists are not passed
    if (knownExams.length === 0 && knownHackathons.length === 0 && knownSlackDays.length === 0 && daySpan >= 60) {
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
    }

    const effectiveStudyDays = timelineDays.filter((d) => d.availableCapacity > 0);
    const totalAvailableStudyMinutes = effectiveStudyDays.reduce(
      (sum, d) => sum + d.availableCapacity,
      0,
    );

    const uncompletedActivities = activities
      .filter((a) => a.status !== 'completed' && !(a.isWatched && a.isCodeDone))
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
      startDate: effectiveStartDate,
      targetDate: effectiveTargetDate,
      courseSlug: effectiveSlug,
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
