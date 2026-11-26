import { Task } from "../models/Task.js";
import { DailyPlan } from "../models/DailyPlan.js";
import { SlackDayLog } from "../models/SlackDayLog.js";
import { ScheduleTemplate } from "../models/ScheduleTemplate.js";
import { ScheduleException } from "../models/ScheduleException.js";
import { TimetableActivation } from "../models/TimetableActivation.js";
import { Setting } from "../models/Setting.js";
import { Course } from "../models/Course.js";
import { CurriculumActivity } from "../models/CurriculumActivity.js";
import { ReadingBook } from "../models/ReadingBook.js";
import { ReadingLog } from "../models/ReadingLog.js";
import { Assignment } from "../models/Assignment.js";
import { Examination } from "../models/Examination.js";
import { Hackathon } from "../models/Hackathon.js";
import { ExecutionRecord } from "../models/ExecutionRecord.js";
import { ExecutionSyncService } from "../services/executionSyncService.js";
import { PlannerEngine } from "../services/plannerEngine.js";
import { WeightLog } from "../models/WeightLog.js";
import { getTodayString } from "../utils/timeFormat.js";
import { removeJournalHistorySchedule } from "../services/journalScheduleMigration.js";
import { ensureOratoryTrack } from "./courseController.js";
import { AllocationService } from "../services/allocationService.js";

function getMonthKey(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export async function getToday(req, res, next) {
  try {
    const today = req.query.date || getTodayString();
    const userId = req.user.id;
    await removeJournalHistorySchedule(userId);
    try {
      await ensureOratoryTrack(userId);
    } catch (trackErr) {
      console.warn("[getToday] ensureOratoryTrack notice:", trackErr.message);
    }

    // 1. Get user settings
    const settings = (await Setting.findOne({ userId })) || {
      dailyMaxWorkMinutes: 480,
      monthlySlackDayAllowance: 3,
    };

    // 2. Resolve date-range TimetableActivation (Priority 1: Most recently created wins)
    const activeRange = await TimetableActivation.findOne({
      userId,
      startDate: { $lte: today },
      endDate: { $gte: today },
    }).sort({ createdAt: -1 });

    const dateException = await ScheduleException.findOne({
      userId,
      date: today,
    });
    let dayType = "weekday";
    let activeProfile = "";
    let isException = false;
    let exceptionDetails = null;

    if (activeRange) {
      dayType = activeRange.profileId;
      activeProfile = activeRange.profileId;
    } else if (dateException) {
      isException = true;
      dayType = dateException.templateOverride || "holiday";
      activeProfile = dayType;
      exceptionDetails = {
        type: dateException.exceptionType,
        notes: dateException.notes,
        extraAvailableMinutes: dateException.extraAvailableMinutes || 0,
      };
    } else if (
      settings.examModeEnabled &&
      settings.examModeStartDate &&
      settings.examModeEndDate &&
      new Date(today) >= new Date(settings.examModeStartDate) &&
      new Date(today) <= new Date(settings.examModeEndDate)
    ) {
      dayType = "exam";
      activeProfile = "exam";
    } else {
      const [y, m, d] = today.split("-").map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 is Sunday, 6 is Saturday
      if (dayOfWeek === 0) dayType = "sunday";
      else if (dayOfWeek === 6) dayType = "saturday";
      else dayType = "weekday";
      activeProfile = dayType;
    }

    // 3. Get timetable template blocks for today
    const template =
      (await ScheduleTemplate.findOne({ userId, dayType })) ||
      (await ScheduleTemplate.findOne({ userId, isDefault: true }));

    let blocks = [];
    if (
      isException &&
      dateException.customBlocks &&
      dateException.customBlocks.length > 0
    ) {
      blocks = dateException.customBlocks;
    } else {
      blocks = template ? template.blocks : [];
    }

    // Calculate available study/work capacity from non-protected blocks
    let studyCapacityMinutes = 0;
    if (blocks && blocks.length > 0) {
      studyCapacityMinutes = blocks
        .filter((b) =>
          ["study", "webdev", "dsa", "oratory", "exploration"].includes(
            b.category,
          ),
        )
        .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    }
    if (studyCapacityMinutes === 0) {
      studyCapacityMinutes = 330; // default 5.5 hours realistic study window
    }

    if (isException && dateException.extraAvailableMinutes !== undefined) {
      studyCapacityMinutes += dateException.extraAvailableMinutes;
    }

    // Ensure DailyPlan is loaded before syncing today's CurriculumActivity list so Today & Calendar match 1:1
    let dailyPlan = await DailyPlan.findOne({ userId, date: today });
    if (!dailyPlan) {
      try {
        await AllocationService.replanFrom(userId, today, 30);
        dailyPlan = await DailyPlan.findOne({ userId, date: today });
      } catch (allocErr) {
        console.warn("[getToday] AllocationService.replanFrom notice:", allocErr.message);
      }
    }

    const plannedCourseSlugs = new Set(
      (dailyPlan?.coursePlans || []).map((cp) => cp.courseSlug).filter(Boolean)
    );
    const isExamToday = dayType === "exam" || Boolean(dailyPlan?.isExamDay);

    // 4. Link any CurriculumActivity scheduled for today to a canonical Task
    const scheduledActs = await CurriculumActivity.find({
      userId,
      scheduledDate: today,
      status: { $nin: ["completed", "archived"] },
      isWatched: { $ne: true },
    });

    // Dynamically ensure active courses or timetable blocks have today's target activity ready
    // Respect Course startDate, targetDate, and DailyPlan allocations (never schedule during exam mode or outside date window)
    const userActiveCourses = isExamToday ? [] : await Course.find({
      userId,
      status: { $ne: "archived" },
      $or: [
        { startDate: null },
        { startDate: { $lte: today } },
      ],
    }).select("slug category title startDate targetDate totalHours totalMinutes completedMinutes completedLectures totalLectures");

    for (const c of userActiveCourses) {
      // Check if course has already ended
      if (c.targetDate && c.targetDate < today) continue;

      const plannedForCourse = (dailyPlan?.coursePlans || []).find((cp) => cp.courseSlug === c.slug);
      const slugNorm = (c.slug || '').toLowerCase().replace(/[-_]/g, ' ');
      const titleNorm = (c.title || '').toLowerCase();
      const matchingBlocks = (blocks || []).filter((b) => {
        const bLabel = (b.label || '').toLowerCase();
        return (
          b.courseSlug === c.slug ||
          b.category === c.slug ||
          (slugNorm && bLabel.includes(slugNorm)) ||
          (titleNorm && bLabel.includes(titleNorm)) ||
          (c.slug.includes('typing') && bLabel.includes('typing')) ||
          (c.slug.includes('web') && bLabel.includes('web')) ||
          (c.slug.includes('dsa') && bLabel.includes('dsa')) ||
          (c.slug === 'oratory' && (
            b.category === 'oratory' ||
            b.courseSlug === 'oratory' ||
            bLabel.includes('oratory') ||
            bLabel.includes('speech') ||
            bLabel.includes('public speaking')
          )) ||
          (c.category === 'exploration' && (b.category === 'exploration' || b.blockType === 'exploration'))
        );
      });
      const totalBlockMinutes = matchingBlocks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);

      let currentCourseActs = scheduledActs.filter((a) => a.courseSlug === c.slug);
      let currentScheduledMins = currentCourseActs.reduce(
        (sum, a) => sum + (Number(a.remainingMinutes) || Number(a.totalEffortMinutes) || 30),
        0
      );

      const isPlannedInDailyPlan = plannedCourseSlugs.has(c.slug);
      const hasTimetableBlock = matchingBlocks.length > 0;
      const targetMinsForCourse = plannedForCourse?.effortMinTarget || totalBlockMinutes || 45;

      // Only pull/assign activities if the course is actually scheduled today in DailyPlan or has an explicit block
      if (currentScheduledMins < targetMinsForCourse && (isPlannedInDailyPlan || hasTimetableBlock)) {
        const excludeIds = scheduledActs.map((a) => a._id).filter(Boolean);
        const morePending = await CurriculumActivity.find({
          userId,
          courseSlug: c.slug,
          status: { $nin: ["completed", "archived"] },
          isWatched: { $ne: true },
          _id: { $nin: excludeIds },
        })
          .sort({ sectionNumber: 1, subsectionNumber: 1, activityNumber: 1 })
          .limit(10);

        for (const act of morePending) {
          if (currentScheduledMins >= targetMinsForCourse) break;
          if (!act.scheduledDate) {
            act.scheduledDate = today;
            await act.save();
          }
          scheduledActs.push(act);
          const effort = Number(act.remainingMinutes) || Number(act.totalEffortMinutes) || 30;
          currentScheduledMins += effort;
        }

        // If no curriculum activities exist in DB, but course has manual hours:
        if (scheduledActs.filter((a) => a.courseSlug === c.slug).length === 0 && (c.totalHours > 0 || c.totalMinutes > 0)) {
          const startStr = c.startDate || today;
          const endStr = c.targetDate || today;
          if (today >= startStr && (!c.targetDate || today <= endStr)) {
            const startD = new Date(startStr);
            const endD = new Date(endStr);
            const totalDays = Math.max(1, Math.round((endD - startD) / (1000 * 60 * 60 * 24)) + 1);
            const remainingMins = Math.max(0, (c.totalMinutes || c.totalHours * 60) - (c.completedMinutes || 0));
            if (remainingMins > 0) {
              const dailyPaceMins = Math.max(20, Math.round(remainingMins / totalDays));
              const existingManualTask = await Task.findOne({
                userId,
                scheduledDate: today,
                category: c.slug,
                status: { $ne: "completed" },
              });
              if (!existingManualTask) {
                await Task.create({
                  userId,
                  title: `${c.title}: Daily Study & Practice Session`,
                  priority: "P2",
                  category: c.slug,
                  estimatedMinutes: dailyPaceMins,
                  actualMinutes: 0,
                  remainingMinutes: dailyPaceMins,
                  scheduledDate: today,
                  status: "pending",
                });
              }

              // Also provide a synthetic activity so allocateCurriculumToBlocks can assign it to the timetable block
              scheduledActs.push({
                _id: `manual_${c.slug}`,
                id: `manual_${c.slug}`,
                activityId: `manual_${c.slug}`,
                userId,
                courseSlug: c.slug,
                courseTitle: c.title,
                title: `${c.title}: Daily Study & Practice Session`,
                sectionNumber: 1,
                activityNumber: 1,
                totalEffortMinutes: Math.min(totalBlockMinutes || 60, dailyPaceMins),
                remainingMinutes: Math.min(totalBlockMinutes || 60, dailyPaceMins),
                allocatedMinutes: Math.min(totalBlockMinutes || 60, dailyPaceMins),
                scheduledDate: today,
                isManualSession: true,
                status: "pending",
              });
            }
          }
        }
      }
    }

    for (const act of scheduledActs) {
      if (act.isManualSession) continue;
      if (!act.taskId) {
        const expectedTitle = `${act.courseTitle || act.courseSlug.toUpperCase()}: ${act.title}`;
        // Prevent race condition: check if a Task already exists for this activity
        let task = await Task.findOne({
          userId,
          scheduledDate: today,
          status: { $nin: ["cancelled", "deferred"] },
          $or: [
            { activityId: act._id },
            { title: expectedTitle },
          ],
        });

        if (!task) {
          const effortMinutes = Math.max(
            1,
            Math.round(
              Number(act.totalEffortMinutes) ||
                Number(act.remainingMinutes) ||
                Number(act.contentDurationMinutes) * (Number(act.effectiveMultiplier) || 2) ||
                45,
            ),
          );
          const actualMins = Math.max(0, Math.round(Number(act.actualMinutes) || 0));
          const remMins = Math.max(
            0,
            Math.round(Number(act.remainingMinutes) || effortMinutes - actualMins),
          );

          task = await Task.create({
            userId,
            activityId: act._id,
            title: expectedTitle,
            priority: act.priority || "P2",
            category: ["dsa", "webdev", "oratory", "reading"].includes(
              act.courseSlug,
            )
              ? act.courseSlug
              : "general",
            estimatedMinutes: effortMinutes,
            actualMinutes: actualMins,
            remainingMinutes: remMins,
            scheduledDate: today,
            status: act.status || "pending",
          });
        } else if (!task.activityId) {
          task.activityId = act._id;
          await task.save();
        }
        act.taskId = task._id;
        if (typeof act.save === "function") {
          await act.save();
        }
      }
    }

    // 5. Get tasks scheduled for today (exclude cancelled/deferred to prevent duplicate display)
    const rawScheduledTasks = await Task.find({
      userId,
      scheduledDate: today,
      status: { $nin: ["cancelled", "deferred"] },
    }).sort({ priority: 1, deadline: 1, createdAt: 1 });

    // Safeguard deduplication by activityId or normalized title+date
    const seenTaskKeys = new Set();
    const scheduledTasks = [];
    for (const t of rawScheduledTasks) {
      const key = t.activityId ? `act:${t.activityId}` : `title:${(t.title || "").trim().toLowerCase()}`;
      if (!seenTaskKeys.has(key)) {
        seenTaskKeys.add(key);
        scheduledTasks.push(t);
      }
    }

    // 6. Get missed tasks from past dates that are still pending/in-progress
    const missedTasks = await Task.find({
      userId,
      scheduledDate: { $lt: today, $ne: null },
      status: { $in: ["pending", "in-progress"] },
    }).sort({ priority: 1, deadline: 1 });

    // 7. Get backlog tasks (no scheduled date or deferred)
    const backlogTasks = await Task.find({
      userId,
      $or: [{ scheduledDate: null }, { isDeferred: true }],
      status: { $in: ["pending", "in-progress"] },
    }).limit(20);

    // 8. Fallback create DailyPlan if still missing
    if (!dailyPlan) {
      dailyPlan = await DailyPlan.create({
        userId,
        date: today,
        dayType,
        targetCapacityMinutes: studyCapacityMinutes,
        allocatedMinutes: scheduledTasks.reduce(
          (sum, t) => sum + (t.remainingMinutes || t.estimatedMinutes),
          0,
        ),
        tasks: scheduledTasks.map((t) => ({
          taskId: t._id,
          title: t.title,
          priority: t.priority,
          estimatedMinutes: t.estimatedMinutes,
          remainingMinutes: t.remainingMinutes,
          actualMinutes: t.actualMinutes,
          status: t.status,
          isProtected: t.isProtected,
        })),
      });
    }

    // 9. Cross-module data fetching (Reading, Academics, Exams, Hackathons, Executions)
    const [
      activeBooks,
      todayReadingLogs,
      academicAssignments,
      academicExams,
      activeHackathons,
      executionRecords,
      completedCurriculumActs,
      userCourses,
    ] = await Promise.all([
      ReadingBook.find({ userId, status: "reading" }),
      ReadingLog.find({ userId, date: today }),
      Assignment.find({
        userId,
        $or: [
          { dueDate: today },
          { status: { $in: ["pending", "in-progress", "assigned"] } },
        ],
      })
        .sort({ dueDate: 1 })
        .limit(10),
      Examination.find({
        userId,
        $or: [{ examDate: today }, { "preparationDates.date": today }],
      }),
      Hackathon.find({
        userId,
        lifecycleStatus: { $in: ["active", "submission-due", "upcoming"] },
      }),
      ExecutionRecord.find({ userId, date: today }).sort({ createdAt: -1 }),
      CurriculumActivity.find({
        userId,
        $or: [
          { scheduledDate: today, status: "completed" },
          {
            status: "completed",
            completedAt: {
              $gte: new Date(`${today}T00:00:00.000Z`),
              $lte: new Date(`${today}T23:59:59.999Z`),
            },
          },
        ],
      }),
      Course.find({ userId }).select("slug category title"),
    ]);

    const expCourseSlugs = new Set(
      userCourses
        .filter(
          (c) =>
            c.category === "exploration" ||
            c.slug === "exploration" ||
            c.slug === "exploration-lab",
        )
        .map((c) => c.slug),
    );

    // Calculate actual minutes spent today from immutable execution records
    const recordsMinutes = executionRecords.reduce(
      (sum, r) => sum + (r.minutesSpent || 0),
      0,
    );
    const readingMinutes = todayReadingLogs.reduce(
      (sum, r) => sum + (r.durationMinutes || 0),
      0,
    );
    const taskActualMinutes = scheduledTasks.reduce(
      (sum, t) => sum + (t.actualMinutes || 0),
      0,
    );
    const totalActualMinutesSpent = Math.max(
      recordsMinutes,
      taskActualMinutes + readingMinutes,
    );

    // Build Completed Today collection (preserved across refresh and dates)
    const completedTasks = scheduledTasks.filter(
      (t) => t.status === "completed",
    );
    const completedToday = [
      ...completedTasks.map((t) => ({
        id: t._id,
        title: t.title,
        type: "task",
        category: t.category,
        actualMinutes: t.actualMinutes || t.estimatedMinutes || 30,
        completedAt: t.completedAt || t.updatedAt,
      })),
      ...completedCurriculumActs
        .filter(
          (a) =>
            !completedTasks.some(
              (t) => t._id.toString() === a.taskId?.toString(),
            ),
        )
        .map((a) => {
          const isExp =
            expCourseSlugs.has(a.courseSlug) ||
            a.activityType === "exploration";
          return {
            id: a._id,
            title: `${a.courseTitle || (a.courseSlug || "").toUpperCase()}: ${a.title}`,
            type: isExp ? "exploration" : "course",
            courseSlug: a.courseSlug,
            actualMinutes: a.actualMinutes || a.totalEffortMinutes || 45,
            completedAt: a.completedAt || a.updatedAt,
          };
        }),
      ...todayReadingLogs.map((rl) => ({
        id: rl._id,
        title: `Reading: ${rl.bookTitle} (pp. ${rl.startPage}-${rl.endPage})`,
        type: "reading",
        actualMinutes: rl.durationMinutes,
        completedAt: rl.createdAt,
      })),
    ];

    // Build next upcoming activities map for seamless continuation & advance study
    const nextActivitiesMap = new Map();
    for (const act of scheduledActs) {
      const nextAct = await CurriculumActivity.findOne({
        userId,
        courseSlug: act.courseSlug,
        status: { $ne: "completed" },
        _id: { $ne: act._id },
        $or: [
          { sectionNumber: { $gt: act.sectionNumber } },
          {
            sectionNumber: act.sectionNumber,
            activityNumber: { $gt: act.activityNumber },
          },
        ],
      }).sort({ sectionNumber: 1, subsectionNumber: 1, activityNumber: 1 });
      if (nextAct) {
        nextActivitiesMap.set(act._id.toString(), {
          id: nextAct._id,
          title: nextAct.title,
          sectionTitle: nextAct.sectionTitle,
          sectionNumber: nextAct.sectionNumber,
          activityNumber: nextAct.activityNumber,
          contentDurationMinutes: nextAct.contentDurationMinutes,
          totalEffortMinutes: nextAct.totalEffortMinutes,
          remainingMinutes:
            nextAct.remainingMinutes !== undefined
              ? nextAct.remainingMinutes
              : nextAct.totalEffortMinutes,
          scheduledNote: "Scheduled for Tomorrow / Next Study Session",
        });
      }
    }

    // Build unified Scheduled Work items with durations, multipliers and tracker links
    const scheduledWork = [
      ...scheduledActs.map((act) => {
        const contentMins = act.contentDurationMinutes || 30;
        const multiplier = act.practiceMultiplier || 1.6;
        const totalEffort =
          act.totalEffortMinutes || Math.round(contentMins * multiplier);
        const isExp =
          expCourseSlugs.has(act.courseSlug) ||
          act.activityType === "exploration";
        const isOratory = act.courseSlug === "oratory";
        const trackerUrl = isOratory
          ? "oratory.html"
          : isExp
            ? `explore.html?slug=${act.courseSlug}`
            : `tracker.html?slug=${act.courseSlug}`;
        const nextActivity = nextActivitiesMap.get(act._id.toString()) || null;
        const hasPartialProgress =
          (act.actualMinutes > 0 && act.remainingMinutes > 0) ||
          act.status === "in-progress";
        const remMins =
          act.remainingMinutes !== undefined
            ? act.remainingMinutes
            : totalEffort;
        const coachingGuidance = hasPartialProgress
          ? {
              message: `You have ${remMins}m remaining on "${act.title}" from an earlier session. Complete this lecture first before advancing to new material.`,
              remainingMinutes: remMins,
              suggestedPacing: `Finish these ${remMins}m first. Next lecture requires ${nextActivity ? nextActivity.remainingMinutes : 110}m. Aim for at least 100m in your available window.`,
              p3Tip:
                "If pressed for time, borrow 10–15m from P3 activities (Typing Practice or Book Reading), but keep at least 5–10m for Book Reading so your daily streak stays alive.",
            }
          : null;
        return {
          id: act._id,
          type: isExp ? "exploration" : isOratory ? "oratory" : "course",
          sourceType: "CurriculumActivity",
          sourceId: act.courseSlug,
          courseSlug: act.courseSlug,
          courseTitle: act.courseTitle || act.courseSlug.toUpperCase(),
          title: act.title,
          sectionTitle: act.sectionTitle,
          contentDurationMinutes: contentMins,
          practiceMultiplier: multiplier,
          totalEffortMinutes: totalEffort,
          remainingMinutes: remMins,
          actualMinutes: act.actualMinutes || 0,
          priority: act.priority || "P2",
          status: act.status || "pending",
          trackerUrl,
          taskId: act.taskId,
          nextActivity,
          hasPartialProgress,
          coachingGuidance,
        };
      }),
      ...activeBooks.map((b) => ({
        id: b._id,
        type: "reading",
        sourceType: "ReadingBook",
        sourceId: b._id,
        title: `Read: ${b.title}`,
        author: b.author,
        currentPage: b.currentPage || 0,
        totalPages: b.totalPages,
        priority: "P2",
        estimatedMinutes: 35,
        remainingMinutes: 35,
        actualMinutes: 0,
        status: "reading",
        trackerUrl: "reading.html",
      })),
      ...academicAssignments
        .filter((a) => a.dueDate === today || a.status !== "completed")
        .map((a) => ({
          id: a._id,
          type: "academic",
          sourceType: "Assignment",
          sourceId: a._id,
          title: `Assignment: ${a.title}`,
          dueDate: a.dueDate,
          priority: a.priority || "P1",
          estimatedMinutes: a.estimatedMinutes || 60,
          remainingMinutes: a.estimatedMinutes || 60,
          actualMinutes: 0,
          status: a.status,
          trackerUrl: "academics.html",
        })),
      ...academicExams.map((e) => ({
        id: e._id,
        type: "exam_prep",
        sourceType: "Examination",
        sourceId: e._id,
        title:
          e.examDate === today
            ? `EXAM TODAY: ${e.subjectName} (${e.examType})`
            : `Exam Prep: ${e.subjectName}`,
        examDate: e.examDate,
        priority: "P1",
        estimatedMinutes: e.durationMinutes || 120,
        remainingMinutes: e.durationMinutes || 120,
        actualMinutes: 0,
        status: e.status,
        trackerUrl: "academics.html",
      })),
    ];

    // Build timetable block curriculum assignments
    const blockCurriculumMap = PlannerEngine.allocateCurriculumToBlocks({
      blocks,
      activities: scheduledActs,
    });
    const blockAllocations = blockCurriculumMap?.blockAllocations || [];

    // 10. Slack days summary & Active Recovery Status
    const monthKey = getMonthKey(today);
    const slackLogsInMonth = await SlackDayLog.find({
      userId,
      monthKey,
    }).sort({ date: -1 });
    const slackDaysCount = slackLogsInMonth.length;
    const slackDayAllowance =
      settings.monthlySlackDayAllowance !== undefined
        ? settings.monthlySlackDayAllowance
        : 3;
    const recoveryStatus =
      await ExecutionSyncService.getRecoveryBalance(userId);
    const isSunday = dayType === "sunday" || new Date(today).getDay() === 0;
    const latestWeightLog = await WeightLog.findOne({ userId }).sort({ date: -1 });

    return res.json({
      success: true,
      today,
      dayType,
      activeProfile: activeProfile || dayType,
      activeRange,
      isSunday,
      latestWeightLog,
      isException,
      exceptionDetails,
      targetCapacityMinutes: studyCapacityMinutes,
      timetableBlocks: blocks,
      blockAllocations,
      dailyPlan,
      coursePlans: dailyPlan?.coursePlans || [],
      reflection: dailyPlan?.reflection || {
        whatWentWell: "",
        whatStruggled: "",
        whatImprove: "",
        summary: "",
      },
      scheduledTasks,
      scheduledWork,
      completedToday,
      totalActualMinutesSpent,
      reading: {
        activeBooks,
        todayLogs: todayReadingLogs,
      },
      academics: {
        assignments: academicAssignments,
        exams: academicExams,
      },
      hackathons: activeHackathons,
      executionRecords,
      missedTasksCount: missedTasks.length,
      missedTasks,
      backlogTasksCount: backlogTasks.length,
      recoveryStatus,
      slackDayStatus: {
        allowance: slackDayAllowance,
        used: slackDaysCount,
        remaining: Math.max(0, slackDayAllowance - slackDaysCount),
        isTodaySlackDay: Boolean(dailyPlan && dailyPlan.isSlackDay),
        declaredDates: slackLogsInMonth.map((s) => ({
          date: s.date,
          reason: s.reason,
          type: s.type,
        })),
        policy: "emergency_disruption_buffer",
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function replanDay(req, res, next) {
  try {
    const {
      targetDate = getTodayString(),
      requestSlackDay = false,
      slackDayReason = "",
    } = req.body;
    const userId = req.user.id;
    await removeJournalHistorySchedule(userId);
    try {
      await ensureOratoryTrack(userId);
    } catch (trackErr) {
      console.warn("[getToday] ensureOratoryTrack notice:", trackErr.message);
    }

    // 1. Fetch settings
    const settings = (await Setting.findOne({ userId })) || {
      dailyMaxWorkMinutes: 480,
      monthlySlackDayAllowance: 3,
    };

    // 2. Fetch timetable capacity (respecting ScheduleException overrides)
    const targetException = await ScheduleException.findOne({
      userId,
      date: targetDate,
    });
    let dayType = "weekday";
    if (targetException) {
      dayType = targetException.templateOverride || "holiday";
    } else {
      const dayOfWeek = new Date(targetDate).getDay();
      if (dayOfWeek === 0) dayType = "sunday";
      else if (dayOfWeek === 6) dayType = "saturday";
    }

    const template = await ScheduleTemplate.findOne({ userId, dayType });
    let studyCapacityMinutes = 330;
    if (template && template.blocks) {
      studyCapacityMinutes =
        template.blocks
          .filter((b) =>
            ["study", "webdev", "dsa", "oratory", "exploration"].includes(
              b.category,
            ),
          )
          .reduce((sum, b) => sum + (b.durationMinutes || 0), 0) || 330;
    }
    if (targetException && targetException.extraAvailableMinutes) {
      studyCapacityMinutes += targetException.extraAvailableMinutes;
    }

    // 3. Existing tasks for targetDate
    const existingScheduled = await Task.find({
      userId,
      scheduledDate: targetDate,
    });

    // 4. Missed tasks from past dates
    const missedTasks = await Task.find({
      userId,
      scheduledDate: { $lt: targetDate, $ne: null },
      status: { $in: ["pending", "in-progress"] },
    });

    // 5. Backlog
    const backlog = await Task.find({
      userId,
      $or: [{ scheduledDate: null }, { isDeferred: true }],
      status: { $in: ["pending", "in-progress"] },
    });

    // 6. Slack Day allowance & Exam Mode
    const monthKey = getMonthKey(targetDate);
    const slackDaysCount = await SlackDayLog.countDocuments({
      userId,
      monthKey,
    });
    const allowance =
      settings.monthlySlackDayAllowance !== undefined
        ? settings.monthlySlackDayAllowance
        : 3;
    const isExamPeriod =
      dayType === "exam" || Boolean(settings.examModeEnabled);

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate,
      dailyCapacityMinutes: studyCapacityMinutes,
      existingScheduledTasks: existingScheduled,
      missedOrUnfinishedTasks: missedTasks,
      backlogTasks: backlog,
      slackDayStatus: {
        available: Math.max(0, allowance - slackDaysCount),
        used: slackDaysCount,
        isRequested: Boolean(requestSlackDay),
      },
      maxCatchupMinutes: 60,
      examMode: {
        enabled: Boolean(settings.examModeEnabled),
        isExamDay: isExamPeriod,
        focusSubjects: settings.examModeFocusSubjects || [],
      },
    });

    return res.json({
      success: true,
      proposal,
      dayType,
      isException: Boolean(targetException),
      exceptionDetails: targetException
        ? {
            type: targetException.exceptionType,
            notes: targetException.notes,
            extraAvailableMinutes: targetException.extraAvailableMinutes,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmReplan(req, res, next) {
  try {
    const {
      targetDate = getTodayString(),
      acceptedTaskIds = [],
      deferredTaskIds = [],
      isSlackDay = false,
      slackDayReason = "",
    } = req.body;
    const userId = req.user.id;

    // 1. Update accepted tasks -> scheduled for targetDate, not deferred
    if (acceptedTaskIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: acceptedTaskIds }, userId },
        {
          $set: {
            scheduledDate: targetDate,
            isDeferred: false,
            status: "pending",
          },
        },
      );
    }

    // 2. Update deferred tasks -> scheduledDate = null, isDeferred = true & record in RecoveryLedger
    if (deferredTaskIds.length > 0) {
      const deferredTasks = await Task.find({
        _id: { $in: deferredTaskIds },
        userId,
      });
      for (const t of deferredTasks) {
        t.scheduledDate = null;
        t.isDeferred = true;
        t.deferReason = isSlackDay
          ? "Deferred via Slack Day"
          : "Deferred by adaptive capacity replanner";
        await t.save();

        const remaining = t.remainingMinutes || t.estimatedMinutes || 30;
        // Avoid duplicate recovery entries for the same task and sourceDate
        const existingLedger = await RecoveryLedger.findOne({
          userId,
          taskId: t._id,
          sourceDate: targetDate,
          status: { $in: ["active", "partial"] },
        });
        if (!existingLedger) {
          await ExecutionSyncService.recordMissedWork({
            userId,
            sourceDate: targetDate,
            title: t.title,
            courseSlug: t.category,
            taskId: t._id,
            missedMinutes: remaining,
          });
        }
      }
    }

    // 3. If Slack Day, enforce 3-per-month limit & log it (upsert to prevent duplicate logs on retry)
    if (isSlackDay) {
      const monthKey = getMonthKey(targetDate);
      const existingOnDate = await SlackDayLog.findOne({ userId, date: targetDate });
      if (!existingOnDate) {
        const settings = (await Setting.findOne({ userId })) || { monthlySlackDayAllowance: 3 };
        const allowance = Math.min(3, settings.monthlySlackDayAllowance !== undefined ? Number(settings.monthlySlackDayAllowance) : 3);
        const usedInMonth = await SlackDayLog.countDocuments({ userId, monthKey });
        if (usedInMonth >= allowance) {
          return res.status(400).json({
            success: false,
            message: `Monthly Slack Day allowance (${allowance}) already exhausted for ${monthKey}. Unused days do not carry forward.`,
          });
        }
      }
      await SlackDayLog.findOneAndUpdate(
        { userId, date: targetDate },
        {
          $set: {
            monthKey,
            reason: slackDayReason || "Intentional recovery / disruption buffer",
            tasksDeferredCount: deferredTaskIds.length,
            deferredTaskIds,
            replanApplied: true,
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
    }

    // 4. Update DailyPlan
    const acceptedTasks = await Task.find({
      _id: { $in: acceptedTaskIds },
      userId,
    });
    const totalAllocated = acceptedTasks.reduce(
      (sum, t) => sum + (t.remainingMinutes || t.estimatedMinutes),
      0,
    );

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: targetDate },
      {
        $set: {
          allocatedMinutes: totalAllocated,
          isSlackDay: Boolean(isSlackDay),
          slackDayReason: slackDayReason || "",
          status: "recalculated",
        },
        $inc: { replanCount: 1 },
        $push: {
          replanHistory: {
            timestamp: new Date(),
            reason: isSlackDay ? "Slack Day activated" : "Capacity rebalanced",
            proposalSummary: `Scheduled: ${acceptedTaskIds.length} tasks (${totalAllocated}m). Deferred: ${deferredTaskIds.length} tasks.`,
            tasksModified: acceptedTaskIds.length + deferredTaskIds.length,
          },
        },
      },
      { new: true, upsert: true },
    );

    return res.json({
      success: true,
      message: "Replan proposal applied successfully.",
      plan,
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

    const settings = (await Setting.findOne({ userId })) || {
      monthlySlackDayAllowance: 3,
    };
    const logs = await SlackDayLog.find({ userId, monthKey }).sort({
      date: -1,
    });
    const count = logs.length;
    const allowance = Math.min(
      3,
      settings.monthlySlackDayAllowance !== undefined ? Number(settings.monthlySlackDayAllowance) : 3,
    );

    return res.json({
      success: true,
      monthKey,
      allowance,
      usedCount: count,
      remainingCount: Math.max(0, allowance - count),
      logs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Explicitly declare a Slack Day for a given date.
 * - Enforces strict 3-per-calendar-month limit on backend.
 * - Idempotent on repeated clicks/requests for the same date.
 * - Evaluates Courses Hub, Exploration Hub, Oratory, and Reading Books (explicitly excludes Academics & Night Routine).
 * - Creates a realistic lighter schedule without cancelling the entire day, preserves partial execution,
 *   records genuinely unfinished work in RecoveryLedger, and replans future capacity cleanly.
 */
export async function declareSlackDay(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      date = getTodayString(),
      reason = "Intentional recovery / disruption buffer",
      type = "unavoidable_disruption",
    } = req.body || {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Valid YYYY-MM-DD date is required." });
    }

    const monthKey = getMonthKey(date);
    const settings = (await Setting.findOne({ userId })) || { monthlySlackDayAllowance: 3 };
    const allowance = Math.min(
      3,
      settings.monthlySlackDayAllowance !== undefined ? Number(settings.monthlySlackDayAllowance) : 3,
    );

    // Idempotency check: prevent duplicate declaration on same date
    const existingLog = await SlackDayLog.findOne({ userId, date });
    if (existingLog) {
      const logs = await SlackDayLog.find({ userId, monthKey }).sort({ date: -1 });
      return res.json({
        success: true,
        alreadyDeclared: true,
        message: `Slack Day already declared for ${date}.`,
        log: existingLog,
        slackDayStatus: {
          allowance,
          used: logs.length,
          remaining: Math.max(0, allowance - logs.length),
        },
      });
    }

    // Monthly limit enforcement (no carry-forward)
    const usedInMonth = await SlackDayLog.countDocuments({ userId, monthKey });
    if (usedInMonth >= allowance) {
      return res.status(400).json({
        success: false,
        message: `Monthly Slack Day limit of ${allowance} reached for ${monthKey}. Unused days do not carry forward.`,
      });
    }

    // Gather eligible scheduled work on this date across the 4 modules:
    // Courses Hub, Exploration Hub, Oratory, Reading Books.
    // Explicitly EXCLUDE Academics (category: academic/academics) and Night Routine.
    const dayPlanBefore = await DailyPlan.findOne({ userId, date });
    const scheduledActs = await CurriculumActivity.find({
      userId,
      scheduledDate: date,
      status: { $nin: ["completed", "archived"] },
      courseSlug: { $nin: ["academics", "academic"] },
    });
    const scheduledTasks = await Task.find({
      userId,
      scheduledDate: date,
      status: { $nin: ["completed", "cancelled"] },
      category: { $nin: ["academic", "academics", "night-routine", "night_routine"] },
    });

    const lightenedItems = [];
    const deferredRecoveryItems = [];

    // 1. Handle scheduled curriculum activities (Courses, Explorations, Oratory)
    for (const act of scheduledActs) {
      const totalPlanned = Number(act.totalEffortMinutes) || Number(act.allocatedMinutes) || 30;
      const doneSoFar = Number(act.actualMinutes) || 0;
      const genuineRemaining = Math.max(0, totalPlanned - doneSoFar);
      if (genuineRemaining <= 0) continue;

      const isExplorationOrOratory = act.courseSlug === "oratory" || act.category === "exploration";
      if (isExplorationOrOratory) {
        await ExecutionSyncService.recordMissedWork({
          userId,
          sourceDate: date,
          title: act.title,
          courseSlug: act.courseSlug,
          activityId: act._id,
          missedMinutes: genuineRemaining,
        });
        deferredRecoveryItems.push({
          module: act.courseSlug === "oratory" ? "oratory" : "exploration",
          title: act.title,
          remainingMinutes: genuineRemaining,
        });
      } else {
        // Core course: retain lighter portion (50%), move remaining to recovery
        const retainedMins = Math.max(15, Math.round(genuineRemaining * 0.5));
        const recoveredMins = genuineRemaining - retainedMins;
        lightenedItems.push({
          module: "course",
          title: act.title,
          retainedMinutes: retainedMins,
        });
        if (recoveredMins > 0) {
          await ExecutionSyncService.recordMissedWork({
            userId,
            sourceDate: date,
            title: `${act.title} (Slack buffer remainder)`,
            courseSlug: act.courseSlug,
            activityId: act._id,
            missedMinutes: recoveredMins,
          });
          deferredRecoveryItems.push({
            module: "course",
            title: act.title,
            remainingMinutes: recoveredMins,
          });
        }
      }
    }

    // 2. Handle non-academic, non-night-routine tasks (e.g. Reading Books or general flexible tasks)
    const deferredTaskIds = [];
    for (const t of scheduledTasks) {
      const rem = Math.max(0, (t.remainingMinutes ?? t.estimatedMinutes ?? 30));
      if (rem <= 0) continue;

      if (t.isProtected || t.priority === "P1") {
        lightenedItems.push({ module: t.category || "task", title: t.title, retainedMinutes: rem });
      } else {
        t.scheduledDate = null;
        t.isDeferred = true;
        t.deferReason = "Deferred via Slack Day";
        await t.save();
        deferredTaskIds.push(t._id);

        await ExecutionSyncService.recordMissedWork({
          userId,
          sourceDate: date,
          title: t.title,
          courseSlug: t.category || "reading",
          taskId: t._id,
          missedMinutes: rem,
        });
        deferredRecoveryItems.push({
          module: t.category || "task",
          title: t.title,
          remainingMinutes: rem,
        });
      }
    }

    // 3. Create SlackDayLog (unique on userId + date)
    const log = await SlackDayLog.create({
      userId,
      date,
      monthKey,
      reason,
      type,
      tasksDeferredCount: deferredTaskIds.length,
      deferredTaskIds,
      replanApplied: true,
    });

    // 4. Replan future dates (including this Slack Day's lighter schedule)
    await AllocationService.replanFrom(userId, date, 150);

    const updatedLogs = await SlackDayLog.find({ userId, monthKey }).sort({ date: -1 });
    return res.status(201).json({
      success: true,
      message: `Slack Day declared for ${date}. Lighter schedule applied; ${deferredRecoveryItems.length} item(s) scheduled for gradual recovery.`,
      log,
      lightenedItems,
      deferredRecoveryItems,
      slackDayStatus: {
        allowance,
        used: updatedLogs.length,
        remaining: Math.max(0, allowance - updatedLogs.length),
      },
      beforeAllocatedMinutes: dayPlanBefore?.allocatedMinutes || 0,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ success: true, alreadyDeclared: true, message: "Slack Day already declared for this date." });
    }
    next(err);
  }
}

export async function recordAvailability(req, res, next) {
  try {
    const {
      date = getTodayString(),
      deltaMinutes,
      reason = "",
      templateOverride,
    } = req.body;
    if (deltaMinutes === undefined || isNaN(Number(deltaMinutes))) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Valid deltaMinutes number is required.",
        });
    }

    const delta = Number(deltaMinutes);
    const userId = req.user.id;

    let exception = await ScheduleException.findOne({ userId, date });
    if (!exception) {
      exception = new ScheduleException({
        userId,
        date,
        exceptionType: delta > 0 ? "custom_free" : "extra_classes",
        templateOverride:
          templateOverride || (delta > 0 ? "holiday" : "weekday"),
        extraAvailableMinutes: delta,
        notes: reason.trim(),
      });
    } else {
      exception.extraAvailableMinutes =
        (exception.extraAvailableMinutes || 0) + delta;
      if (reason)
        exception.notes = exception.notes
          ? `${exception.notes} | ${reason.trim()}`
          : reason.trim();
      if (templateOverride) exception.templateOverride = templateOverride;
    }
    await exception.save();

    // Check eligible activities that can fit in this opportunity
    const opportunities = [];
    if (delta > 0) {
      // 1. Check active recovery ledger
      const recoveryData =
        await ExecutionSyncService.getRecoveryBalance(userId);
      if (recoveryData.remainingMinutes > 0) {
        opportunities.push({
          type: "recovery",
          title: "Gradual Recovery Session",
          recommendedMinutes: Math.min(
            delta,
            Math.min(60, recoveryData.remainingMinutes),
          ),
          remainingBalance: recoveryData.remainingMinutes,
          reason: "Recover previously deferred work without impacting tomorrow",
        });
      }

      // 2. Check pending activities in active courses
      const pendingActivities = await CurriculumActivity.find({
        userId,
        status: { $in: ["pending", "in-progress"] },
      }).limit(5);

      for (const act of pendingActivities) {
        const effort = act.remainingMinutes || act.totalEffortMinutes || 45;
        if (effort <= delta) {
          opportunities.push({
            type: "course_advance",
            activityId: act._id,
            courseSlug: act.courseSlug,
            title: `${act.courseTitle || act.courseSlug.toUpperCase()}: ${act.title}`,
            recommendedMinutes: effort,
            reason: "Advance your course roadmap during unexpected free time",
          });
        }
      }
    }

    return res.json({
      success: true,
      date,
      newExtraMinutes: exception.extraAvailableMinutes,
      opportunities,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRecoveryStatus(req, res, next) {
  try {
    const data = await ExecutionSyncService.getRecoveryBalance(req.user.id);
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function acceptRecoveryOpportunity(req, res, next) {
  try {
    const { minutes, title, courseSlug, date = getTodayString() } = req.body;
    const recoveryMinutes = Number(minutes) || 30;

    const task = await Task.create({
      userId: req.user.id,
      title: title || "Gradual Recovery Session",
      priority: "P2",
      category: courseSlug || "general",
      estimatedMinutes: recoveryMinutes,
      actualMinutes: 0,
      remainingMinutes: recoveryMinutes,
      scheduledDate: date,
      status: "pending",
      description: "Logged via Adaptive Recovery Engine",
    });

    return res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export async function allocateCurriculum(req, res, next) {
  try {
    const { date = getTodayString(), materializeTasks = false } = req.body;
    const userId = req.user.id;

    // 1. Get schedule blocks for date
    const dateException = await ScheduleException.findOne({ userId, date });
    let blocks = [];
    if (dateException && dateException.customBlocks?.length) {
      blocks = dateException.customBlocks;
    } else {
      const dayOfWeek = new Date(date).getDay();
      const dayType =
        dayOfWeek === 0 ? "sunday" : dayOfWeek === 6 ? "saturday" : "weekday";
      const tmpl =
        (await ScheduleTemplate.findOne({ userId, dayType })) ||
        (await ScheduleTemplate.findOne({ userId, isDefault: true }));
      blocks = tmpl ? tmpl.blocks : [];
    }

    // 2. Fetch pending activities
    const activities = await CurriculumActivity.find({
      userId,
      status: { $ne: "completed" },
    });

    // 3. Perform section-aware allocation
    const allocation = PlannerEngine.allocateCurriculumToBlocks({
      blocks,
      activities,
    });

    // 4. Materialize as tasks if requested
    const createdTasks = [];
    if (materializeTasks && allocation.allocatedActivitiesCount > 0) {
      for (const act of activities) {
        const idStr = act._id.toString();
        if (allocation.allocatedActivityIds.includes(idStr) && !act.taskId) {
          const effort = Math.max(
            1,
            Math.round(Number(act.remainingMinutes) || Number(act.totalEffortMinutes) || 45),
          );
          const task = await Task.create({
            userId,
            title: `${act.courseTitle || (act.courseSlug || "").toUpperCase()}: ${act.title}`,
            priority: act.priority || "P2",
            category: act.courseSlug || "general",
            estimatedMinutes: effort,
            actualMinutes: Math.max(0, Math.round(Number(act.actualMinutes) || 0)),
            remainingMinutes: effort,
            scheduledDate: date,
            status: "pending",
          });
          act.taskId = task._id;
          act.scheduledDate = date;
          await act.save();
          createdTasks.push(task);
        }
      }
    }

    return res.json({
      success: true,
      date,
      allocation,
      createdTasksCount: createdTasks.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function saveDailyReflection(req, res, next) {
  try {
    const {
      date = getTodayString(),
      whatWentWell = "",
      whatStruggled = "",
      whatImprove = "",
      summary = "",
    } = req.body;
    const userId = req.user.id;
    let plan = await DailyPlan.findOne({ userId, date });
    if (!plan) {
      plan = new DailyPlan({ userId, date });
    }
    plan.reflection = {
      whatWentWell: String(whatWentWell || "").trim(),
      whatStruggled: String(whatStruggled || "").trim(),
      whatImprove: String(whatImprove || "").trim(),
      summary: String(summary || "").trim(),
    };
    await plan.save();
    return res.json({ success: true, date, reflection: plan.reflection });
  } catch (err) {
    next(err);
  }
}

export async function distributePlanner(req, res, next) {
  try {
    const userId = req.user.id;
    const { fromDate, horizonDays } = req.body || {};
    const today = fromDate || getTodayString();
    const result = await AllocationService.replanFrom(
      userId,
      today,
      Number(horizonDays) || 150,
    );
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCalendarEvents(req, res, next) {
  try {
    const userId = req.user.id;
    const { month, start, end, from, to } = req.query;
    let startDateStr, endDateStr;
    if (from && to) {
      startDateStr = from;
      endDateStr = to;
    } else if (start && end) {
      startDateStr = start;
      endDateStr = end;
    } else {
      const targetMonth = month || getMonthKey(getTodayString());
      startDateStr = `${targetMonth}-01`;
      const [y, m] = targetMonth.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      endDateStr = `${targetMonth}-${String(lastDay).padStart(2, "0")}`;
    }

    const [
      tasks,
      exams,
      assignments,
      hackathons,
      exceptions,
      slackLogs,
      executionRecords,
      dailyPlans,
      curriculumActivities,
      courses,
      activations,
      templates,
    ] = await Promise.all([
      Task.find({
        userId,
        $or: [
          { scheduledDate: { $gte: startDateStr, $lte: endDateStr } },
          { deadline: { $gte: startDateStr, $lte: endDateStr } },
        ],
      }),
      Examination.find({
        userId,
        $or: [
          { examDate: { $gte: startDateStr, $lte: endDateStr } },
          { "preparationDates.date": { $gte: startDateStr, $lte: endDateStr } },
        ],
      }),
      Assignment.find({
        userId,
        dueDate: { $gte: startDateStr, $lte: endDateStr },
      }),
      Hackathon.find({
        userId,
        $or: [
          { startDate: { $lte: endDateStr }, endDate: { $gte: startDateStr } },
          { "stages.deadline": { $gte: startDateStr, $lte: endDateStr } },
        ],
      }),
      ScheduleException.find({
        userId,
        date: { $gte: startDateStr, $lte: endDateStr },
      }),
      SlackDayLog.find({
        userId,
        date: { $gte: startDateStr, $lte: endDateStr },
      }),
      ExecutionRecord.find({
        userId,
        date: { $gte: startDateStr, $lte: endDateStr },
      }),
      DailyPlan.find({
        userId,
        date: { $gte: startDateStr, $lte: endDateStr },
      }),
      CurriculumActivity.find({
        userId,
        $or: [
          { scheduledDate: { $gte: startDateStr, $lte: endDateStr } },
          { completedDate: { $gte: startDateStr, $lte: endDateStr } },
        ],
      }),
      Course.find({ userId }).select("slug title emoji category status totalLectures completedLectures totalMinutes completedMinutes totalHours startDate targetDate"),
      TimetableActivation.find({ userId }).sort({ createdAt: -1 }),
      ScheduleTemplate.find({ userId }),
    ]);

    // Calculate Whole Month Target Summary for course curriculum progress and study effort
    const plannedActivities = curriculumActivities.filter(
      (a) => a.scheduledDate >= startDateStr && a.scheduledDate <= endDateStr
    );
    const completedActivities = curriculumActivities.filter(
      (a) =>
        a.status === "completed" &&
        ((a.completedDate && a.completedDate >= startDateStr && a.completedDate <= endDateStr) ||
         (a.scheduledDate && a.scheduledDate >= startDateStr && a.scheduledDate <= endDateStr))
    );

    let plannedMinutes = plannedActivities.reduce((sum, a) => {
      const mult = a.effectiveMultiplier || 2.0;
      const dur = a.totalEffortMinutes || Math.round((a.contentDurationMinutes || 0) * mult) || 45;
      return sum + dur;
    }, 0);

    // Also include planned minutes for active courses with manual hours
    for (const c of courses) {
      if (c.status === "active" && c.totalHours > 0) {
        const cStart = c.startDate || startDateStr;
        const cEnd = c.targetDate || endDateStr;
        if (cStart <= endDateStr && cEnd >= startDateStr) {
          const overlapStart = cStart > startDateStr ? cStart : startDateStr;
          const overlapEnd = cEnd < endDateStr ? cEnd : endDateStr;
          const overlapDays = Math.max(1, Math.round((new Date(overlapEnd) - new Date(overlapStart)) / (1000 * 60 * 60 * 24)) + 1);
          const totalDays = Math.max(1, Math.round((new Date(cEnd) - new Date(cStart)) / (1000 * 60 * 60 * 24)) + 1);
          const courseDailyMins = (c.totalHours * 60) / totalDays;
          plannedMinutes += Math.round(courseDailyMins * overlapDays);
        }
      }
    }

    const completedMinutes = executionRecords.reduce((sum, r) => sum + (r.minutesSpent || 0), 0);

    const monthTargetSummary = {
      plannedLectures: plannedActivities.length,
      completedLectures: completedActivities.length,
      lectureCompletionRate:
        plannedActivities.length > 0
          ? Math.round((completedActivities.length / plannedActivities.length) * 100)
          : 0,
      plannedHours: Math.round((plannedMinutes / 60) * 10) / 10,
      completedHours: Math.round((completedMinutes / 60) * 10) / 10,
      hourCompletionRate:
        plannedMinutes > 0
          ? Math.min(100, Math.round((completedMinutes / plannedMinutes) * 100))
          : 0,
      activeCoursesCount: courses.filter((c) => c.status === "active").length,
    };

    return res.json({
      success: true,
      startDate: startDateStr,
      endDate: endDateStr,
      tasks,
      exams,
      assignments,
      hackathons,
      exceptions,
      slackLogs,
      executionRecords,
      dailyPlans,
      curriculumActivities,
      courses,
      activations,
      templates,
      monthTargetSummary,
    });
  } catch (err) {
    next(err);
  }
}
