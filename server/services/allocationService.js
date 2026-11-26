import mongoose from "mongoose";
import { Course } from "../models/Course.js";
import { CurriculumActivity } from "../models/CurriculumActivity.js";
import { DailyPlan } from "../models/DailyPlan.js";
import { ExecutionRecord } from "../models/ExecutionRecord.js";
import { ScheduleTemplate } from "../models/ScheduleTemplate.js";
import { TimetableActivation } from "../models/TimetableActivation.js";
import { ScheduleException } from "../models/ScheduleException.js";
import { Examination } from "../models/Examination.js";
import { Hackathon } from "../models/Hackathon.js";
import { SlackDayLog } from "../models/SlackDayLog.js";
import { Setting } from "../models/Setting.js";
import { PlannerEngine } from "./plannerEngine.js";
import { getTodayString } from "../utils/timeFormat.js";

export class AllocationService {
  /**
   * Thin database wrapper that loads inputs from MongoDB, invokes the pure
   * PlannerEngine.allocate function, and commits the resulting DayPlans.
   * 
   * Past dates (< fromDate) are completely frozen history and never rewritten.
   * Only fromDate and future dates are updated.
   * 
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {string} [fromDate] - YYYY-MM-DD date in Asia/Kolkata (defaults to today)
   * @param {number} [horizonDays=150]
   * @returns {Promise<Object>}
   */
  static async replanFrom(userId, fromDate = null, horizonDays = 150) {
    if (!userId) throw new Error("userId is required for replanFrom.");
    const effectiveFromDate = fromDate || getTodayString();

    // 1. Fetch user settings
    const settings = (await Setting.findOne({ userId })) || {
      dailyMaxWorkMinutes: 480,
      monthlySlackDayAllowance: 3,
      defaultPracticeMultiplier: 2.0,
      fallbackHubEffortMinutes: 150,
      fallbackExplorationEffortMinutes: 45,
      availabilityBufferRatio: 0.25,
    };

    // 2. Fetch courses and their activities
    const [courses, activities, progressLogs, templates, activations, exceptions, exams, hackathons, slackLogs] =
      await Promise.all([
        Course.find({ userId, status: { $ne: "archived" } }).lean(),
        CurriculumActivity.find({ userId }).sort({ sectionNumber: 1, activityNumber: 1 }).lean(),
        ExecutionRecord.find({ userId }).sort({ date: 1 }).lean(),
        ScheduleTemplate.find({ userId }).lean(),
        TimetableActivation.find({ userId }).sort({ createdAt: -1, startDate: 1 }).lean(),
        ScheduleException.find({ userId }).lean(),
        Examination.find({ userId }).lean(),
        Hackathon.find({ userId }).lean(),
        SlackDayLog.find({ userId }).lean(),
      ]);

    // Group activities by courseSlug
    const actsByCourse = new Map();
    const completedByCourse = {};

    for (const act of activities) {
      const slug = act.courseSlug || "general";
      if (!actsByCourse.has(slug)) actsByCourse.set(slug, []);
      actsByCourse.get(slug).push({
        lectureNumber: act.activityNumber,
        title: act.title,
        videoDurationMinutes: act.contentDurationMinutes || 30,
        totalEffortMinutes: act.totalEffortMinutes || 60,
        isCompleted: act.status === "completed" || (act.isWatched && act.isCodeDone),
      });

      if (act.status === "completed" || (act.isWatched && act.isCodeDone)) {
        if (!completedByCourse[slug]) completedByCourse[slug] = new Set();
        completedByCourse[slug].add(act.activityNumber);
      }
    }

    // Attach discrete activities to courses if available
    const enrichedCourses = courses.map((c) => {
      const courseActs = actsByCourse.get(c.slug) || [];
      return {
        ...c,
        id: c._id?.toString() || c.slug,
        lectures: courseActs.length > 0 ? courseActs : c.lectures || [],
      };
    });

    // 3. Build timetable resolution map
    const templateMap = new Map();
    for (const t of templates) {
      templateMap.set(t.dayType, t);
    }

    const timetablePerDate = (dateStr) => {
      // Priority 1: TimetableActivation date-range overrides (e.g. exam profile)
      // Most recently created activation wins if ranges overlap (activations sorted by createdAt: -1)
      const activeRange = activations.find(
        (a) => a.startDate <= dateStr && dateStr <= a.endDate,
      );
      if (activeRange) {
        const tmpl = templateMap.get(activeRange.profileId);
        return {
          dayType: activeRange.profileId,
          activeProfile: activeRange.profileId,
          isConfirmedSchedule: true,
          scheduleSource: "activation",
          blocks: tmpl ? tmpl.blocks || [] : [],
        };
      }

      // Priority 2: Single-day schedule exceptions
      const exc = exceptions.find((e) => e.date === dateStr);
      if (exc) {
        if (exc.customBlocks && exc.customBlocks.length > 0) {
          return { dayType: exc.templateOverride || "custom", activeProfile: exc.templateOverride || "custom", isConfirmedSchedule: true, scheduleSource: "exception", blocks: exc.customBlocks };
        }
        const tmpl = templateMap.get(exc.templateOverride);
        if (tmpl) return { dayType: exc.templateOverride, activeProfile: exc.templateOverride, isConfirmedSchedule: true, scheduleSource: "exception", blocks: tmpl.blocks || [] };
      }

      // Priority 3: Standard day-of-week templates (assumed default)
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday, 6 = Saturday
      const key = dow === 0 ? "sunday" : dow === 6 ? "saturday" : "weekday";
      const tmpl = templateMap.get(key);
      return { dayType: key, activeProfile: key, isConfirmedSchedule: false, scheduleSource: "assumed-default", blocks: tmpl ? tmpl.blocks || [] : [] };
    };

    // 4. Build special dates sets
    const examDates = new Set();
    exams.forEach((e) => {
      if (e.examDate) examDates.add(e.examDate);
      if (Array.isArray(e.preparationDates)) {
        e.preparationDates.forEach((pd) => {
          const dStr = typeof pd === "string" ? pd : pd.date;
          if (dStr) examDates.add(dStr);
        });
      }
    });

    const hackathonDates = new Set();
    hackathons.forEach((h) => {
      if (h.startDate && h.endDate) {
        const [sy, sm, sd] = h.startDate.split("-").map(Number);
        const [ey, em, ed] = h.endDate.split("-").map(Number);
        let cur = new Date(Date.UTC(sy, sm - 1, sd));
        const endD = new Date(Date.UTC(ey, em - 1, ed));
        while (cur <= endD) {
          hackathonDates.add(cur.toISOString().slice(0, 10));
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }
    });

    const slackDates = new Set(slackLogs.map((s) => s.date).filter(Boolean));

    // 5. Call the pure deterministic allocator
    const allocationResult = PlannerEngine.allocate({
      courses: enrichedCourses,
      progressLogs,
      completedLectures: completedByCourse,
      timetablePerDate,
      specialDates: { examDates, hackathonDates, slackDates },
      settings: {
        fallbackHubEffortMinutes: settings.fallbackHubEffortMinutes || 150,
        fallbackExplorationEffortMinutes: settings.fallbackExplorationEffortMinutes || 45,
        availabilityBufferRatio: settings.availabilityBufferRatio !== undefined ? settings.availabilityBufferRatio : 0.25,
        dailyMaxWorkMinutes: settings.dailyMaxWorkMinutes || 480,
        semesterExamDaysBudget: Math.min(14, Math.max(1, Number(settings.semesterExamDaysBudget) || 14)),
      },
      today: effectiveFromDate,
      horizonDays,
    });

    // 6. Commit day plans to MongoDB (FREEZING past dates)
    const bulkOps = [];
    for (const dp of allocationResult.dayPlans) {
      if (dp.date < effectiveFromDate) continue; // Past dates are completely frozen

      bulkOps.push({
        updateOne: {
          filter: { userId, date: dp.date },
          update: {
            $set: {
              userId,
              date: dp.date,
              dayType: dp.dayType,
              activeProfile: dp.activeProfile || dp.dayType,
              isConfirmedSchedule: Boolean(dp.isConfirmedSchedule),
              scheduleSource: dp.scheduleSource || "assumed-default",
              isExamDay: dp.isExamDay,
              isHackathon: dp.isHackathon,
              isSlackDay: dp.isSlackDay,
              allocatedMinutes: dp.allocatedMinutes,
              coursePlans: dp.coursePlans,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              targetCapacityMinutes: 330,
              completedMinutes: 0,
              tasks: [],
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await DailyPlan.bulkWrite(bulkOps);
    }

    return {
      success: true,
      fromDate: effectiveFromDate,
      daysPlanned: allocationResult.dayPlans.length,
      feasibility: allocationResult.feasibility,
      slackProposal: allocationResult.slackProposal,
    };
  }
}
