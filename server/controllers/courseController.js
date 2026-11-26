import mongoose from "mongoose";
import { Course } from "../models/Course.js";
import { OratoryWeek } from "../models/OratoryWeek.js";
import { CurriculumActivity } from "../models/CurriculumActivity.js";
import { CurriculumImporter } from "../services/curriculumImporter.js";
import { ExecutionSyncService } from "../services/executionSyncService.js";
import {
  migrateCoursesToActivities,
  cleanLegacySeededCourses,
} from "../services/curriculumMigration.js";
import { Setting } from "../models/Setting.js";
import { ScheduleTemplate } from "../models/ScheduleTemplate.js";
import { Examination } from "../models/Examination.js";
import { Hackathon } from "../models/Hackathon.js";
import { SlackDayLog } from "../models/SlackDayLog.js";
import { Task } from "../models/Task.js";
import { PlannerEngine } from "../services/plannerEngine.js";
import { getTodayString, shiftDate } from "../utils/timeFormat.js";
import { AllocationService } from "../services/allocationService.js";
import {
  parseWebDevMarkdown,
  parseDSAMarkdown,
  getOratoryWeeksSeed,
} from "../services/courseSeeder.js";

export async function syncCourseFromActivities(userId, courseSlug) {
  if (!userId || !courseSlug) return null;
  const course = await Course.findOne({ userId, slug: courseSlug });
  if (!course) return null;

  const allActs = await CurriculumActivity.find({ userId, courseSlug });
  if (allActs.length > 0) {
    course.totalLectures = allActs.length;
    course.completedLectures = allActs.filter(
      (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
    ).length;
    course.totalMinutes = Math.round(
      allActs.reduce((s, a) => s + (a.totalEffortMinutes || 0), 0),
    );
    course.completedMinutes = Math.round(
      allActs
        .filter(
          (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
        )
        .reduce(
          (s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0),
          0,
        ),
    );
    course.totalHours = Math.round((course.totalMinutes / 60) * 10) / 10;
    if (course.totalLectures > 0 && course.completedLectures >= course.totalLectures) {
      course.status = "archived";
    } else if (course.status === "archived" && course.completedLectures < course.totalLectures) {
      course.status = "active";
    }
  } else {
    // Manual hours course without CSV syllabus
    if (course.totalHours > 0 && !course.totalMinutes) {
      course.totalMinutes = Math.round(course.totalHours * 60);
    } else if (course.totalMinutes > 0 && !course.totalHours) {
      course.totalHours = Math.round((course.totalMinutes / 60) * 10) / 10;
    }
  }
  course.updatedAt = new Date();
  await course.save();

  try {
    await AllocationService.replanFrom(userId, getTodayString());
  } catch (replanErr) {
    // Non-blocking trigger notice
  }

  return course;
}

export async function ensureOratoryTrack(userId) {
  if (!userId) return null;

  // 1. Ensure OratoryWeek has all 13 weekly plans
  let weeks = await OratoryWeek.find({ userId }).sort({ weekNumber: 1 });
  if (weeks.length === 0) {
    const seed = getOratoryWeeksSeed();
    const docs = seed.map((w) => ({
      userId,
      weekNumber: w.weekNumber,
      topic: w.topic,
      primarySkill: w.primarySkill || "Public Speaking",
      description: w.description || "",
      isCompleted: false,
    }));
    await OratoryWeek.insertMany(docs);
    weeks = await OratoryWeek.find({ userId }).sort({ weekNumber: 1 });
  }

  // 2. Ensure Course record exists for oratory
  let course = await Course.findOne({ userId, slug: "oratory" });
  if (!course) {
    course = await Course.create({
      userId,
      slug: "oratory",
      title: "Oratory Club & Speech Mastery",
      emoji: "🎙️",
      category: "oratory",
      priority: "P2",
      defaultPracticeMultiplier: 1.0,
      description: "13-Week Speech & Public Speaking Programme covering speech structure, hooks, body language, vocal variety, and storytelling.",
      totalLectures: weeks.length || 13,
      completedLectures: weeks.filter((w) => w.isCompleted).length,
      totalMinutes: (weeks.length || 13) * 45,
      completedMinutes: weeks.filter((w) => w.isCompleted).length * 45,
      totalHours: Math.round((((weeks.length || 13) * 45) / 60) * 10) / 10,
      status: "active",
    });
  }

  // 3. Ensure CurriculumActivity records exist for all 13 weeks
  const existingActs = await CurriculumActivity.find({
    userId,
    courseSlug: "oratory",
  });
  if (existingActs.length < (weeks.length || 13)) {
    const existingWeekNums = new Set(
      existingActs.map((a) => Number(a.activityNumber)),
    );
    const actsToInsert = [];
    for (const w of weeks) {
      if (!existingWeekNums.has(w.weekNumber)) {
        actsToInsert.push({
          userId,
          courseSlug: "oratory",
          courseTitle: "Oratory Club & Speech Mastery",
          sectionNumber: 1,
          sectionTitle: "13-Week Speech & Public Speaking Programme",
          subsectionNumber: 1,
          subsectionTitle: "Weekly Speech Drills & Practice",
          activityNumber: w.weekNumber,
          title: `Week ${w.weekNumber}: ${w.topic}`,
          description: `Primary Skill: ${w.primarySkill || "Speech Practice"}`,
          contentDurationMinutes: 15,
          practiceMultiplier: 2.0,
          effectiveMultiplier: 2.0,
          totalEffortMinutes: 45,
          actualMinutes: w.isCompleted ? 45 : 0,
          remainingMinutes: w.isCompleted ? 0 : 45,
          priority: "P2",
          status: w.isCompleted ? "completed" : "pending",
          isWatched: Boolean(w.isCompleted),
          isCodeDone: Boolean(w.isCompleted),
          completedAt: w.completedAt || (w.isCompleted ? new Date() : null),
          activityType: "speech",
        });
      }
    }
    if (actsToInsert.length > 0) {
      await CurriculumActivity.insertMany(actsToInsert);
    }
  }

  // 4. Bi-directional sync: ensure status in OratoryWeek matches CurriculumActivity
  const allActs = await CurriculumActivity.find({
    userId,
    courseSlug: "oratory",
  }).sort({ activityNumber: 1 });
  const actMap = new Map(allActs.map((a) => [Number(a.activityNumber), a]));
  for (const w of weeks) {
    const act = actMap.get(w.weekNumber);
    if (act) {
      if (w.isCompleted && act.status !== "completed") {
        act.status = "completed";
        act.isWatched = true;
        act.isCodeDone = true;
        act.actualMinutes = act.actualMinutes || act.totalEffortMinutes || 45;
        act.remainingMinutes = 0;
        act.completedAt = w.completedAt || new Date();
        await act.save();
      } else if (!w.isCompleted && act.status === "completed") {
        w.isCompleted = true;
        w.completedAt = act.completedAt || new Date();
        await w.save();
      }
    }
  }

  // 5. Keep Course progress in ground truth sync
  await syncCourseFromActivities(userId, "oratory");
  return { course, weeks, activities: allActs };
}

export async function runCourseTimelineDistribution(userId, course) {
  if (!course || !course.startDate || !course.targetDate) return null;

  let activities = await CurriculumActivity.find({
    userId,
    courseSlug: course.slug,
  }).sort({ sectionNumber: 1, subsectionNumber: 1, activityNumber: 1, orderIndex: 1, sequenceOrder: 1, createdAt: 1 });

  // If no discrete CSV activities exist yet, but manual hours/lectures exist:
  if (activities.length === 0 && (course.totalHours > 0 || course.totalLectures > 0)) {
    const startDt = new Date(course.startDate);
    const endDt = new Date(course.targetDate);
    const daySpan = Math.max(1, Math.round((endDt - startDt) / (1000 * 60 * 60 * 24)) + 1);
    const totalHoursNum = Number(course.totalHours) || 0;
    const totalLecturesNum = Number(course.totalLectures) || 0;
    const totalMins = course.totalMinutes || Math.round(totalHoursNum * 60);
    const sessionCount = totalLecturesNum > 0 ? totalLecturesNum : Math.min(daySpan, Math.max(5, Math.ceil(totalHoursNum || 10)));
    const minutesPerSession = totalMins > 0 ? Math.max(20, Math.round(totalMins / sessionCount)) : 60;
    const multiplier = course.defaultPracticeMultiplier || 2.0;
    const contentPerSession = Math.max(10, Math.round(minutesPerSession / multiplier));

    const actsToCreate = [];
    let curDt = new Date(startDt);
    const stepDays = Math.max(1, Math.floor(daySpan / sessionCount));

    for (let i = 1; i <= sessionCount; i++) {
      const schedDateStr = curDt <= endDt ? curDt.toISOString().slice(0, 10) : endDt.toISOString().slice(0, 10);
      actsToCreate.push({
        userId,
        courseSlug: course.slug,
        courseTitle: course.title,
        activityType: course.category === "exploration" ? "exploration" : "course",
        sectionNumber: 1,
        sectionTitle: "Core Curriculum & Practice",
        activityNumber: i,
        title: `Session ${i}: Focus & Problem Solving`,
        contentDurationMinutes: contentPerSession,
        practiceMultiplier: multiplier,
        effectiveMultiplier: multiplier,
        totalEffortMinutes: minutesPerSession,
        remainingMinutes: minutesPerSession,
        scheduledDate: schedDateStr,
        priority: course.priority || "P2",
        status: "pending",
      });
      curDt.setDate(curDt.getDate() + stepDays);
    }

    await CurriculumActivity.insertMany(actsToCreate);
    course.totalLectures = sessionCount;
    course.totalMinutes = minutesPerSession * sessionCount;
    course.totalHours = Math.round((course.totalMinutes / 60) * 10) / 10;
    await course.save();

    activities = await CurriculumActivity.find({
      userId,
      courseSlug: course.slug,
    }).sort({ sectionNumber: 1, activityNumber: 1 });
  }

  const [weekdayTmpl, satTmpl, sunTmpl, exams, hackathons, slackLogs] = await Promise.all([
    ScheduleTemplate.findOne({ userId, dayType: "weekday" }),
    ScheduleTemplate.findOne({ userId, dayType: "saturday" }),
    ScheduleTemplate.findOne({ userId, dayType: "sunday" }),
    Examination.find({ userId }),
    Hackathon.find({ userId }),
    SlackDayLog.find({ userId }),
  ]);

  const distribution = await PlannerEngine.distributeCourseTimeline({
    courseSlug: course.slug,
    course,
    activities,
    userId,
    startDate: course.startDate,
    targetDate: course.targetDate,
    multiplier: course.defaultPracticeMultiplier || 2.0,
    weekdayBlocks: weekdayTmpl ? weekdayTmpl.blocks : [],
    saturdayBlocks: satTmpl ? satTmpl.blocks : [],
    sundayBlocks: sunTmpl ? sunTmpl.blocks : [],
    weekendBlocks: satTmpl ? satTmpl.blocks : (sunTmpl ? sunTmpl.blocks : []),
    knownExams: exams || [],
    knownHackathons: hackathons || [],
    knownSlackDays: slackLogs || [],
  });

  if (distribution && distribution.allocations && distribution.allocations.length > 0) {
    const actOps = distribution.allocations.map((alloc) => ({
      updateOne: {
        filter: { _id: alloc.activityId, userId },
        update: { $set: { scheduledDate: alloc.scheduledDate } },
      },
    }));
    await CurriculumActivity.bulkWrite(actOps);

    const allocatedActIds = distribution.allocations.map((a) => a.activityId);
    const allocatedActs = await CurriculumActivity.find({
      _id: { $in: allocatedActIds },
      userId,
      taskId: { $ne: null },
    }).select("taskId scheduledDate");

    if (allocatedActs.length > 0) {
      const taskOps = allocatedActs.map((a) => ({
        updateOne: {
          filter: { _id: a.taskId, userId },
          update: { $set: { scheduledDate: a.scheduledDate } },
        },
      }));
      await Task.bulkWrite(taskOps);
    }
  }

  return distribution;
}

export async function getCourses(req, res, next) {
  try {
    // Ensure Oratory track and ground-truth activities exist
    try {
      await ensureOratoryTrack(req.user.id);
    } catch (oratoryErr) {
      console.warn("[getCourses] ensureOratoryTrack notice:", oratoryErr.message);
    }

    const filter = { userId: req.user.id };
    if (req.query.category) {
      filter.category = req.query.category;
    }
    const courses = await Course.find(filter).select(
      "slug title emoji category priority instructor description notes defaultPracticeMultiplier status startDate targetDate totalHours totalLectures completedLectures totalMinutes completedMinutes",
    );

    // Ground-truth aggregation from CurriculumActivity so all lecture completions & additions ALWAYS reflect in Courses Hub
    try {
      const userObjId = mongoose.Types.ObjectId.isValid(req.user.id)
        ? new mongoose.Types.ObjectId(req.user.id)
        : req.user.id;
      const stats = await CurriculumActivity.aggregate([
        { $match: { userId: userObjId } },
        {
          $group: {
            _id: "$courseSlug",
            actCount: { $sum: 1 },
            completedCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", "completed"] },
                      {
                        $and: [
                          { $eq: ["$isWatched", true] },
                          { $eq: ["$isCodeDone", true] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalEffort: { $sum: { $ifNull: ["$totalEffortMinutes", 0] } },
            completedEffort: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", "completed"] },
                      {
                        $and: [
                          { $eq: ["$isWatched", true] },
                          { $eq: ["$isCodeDone", true] },
                        ],
                      },
                    ],
                  },
                  {
                    $ifNull: [
                      "$actualMinutes",
                      { $ifNull: ["$totalEffortMinutes", 0] },
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      ]);

      if (Array.isArray(stats) && stats.length > 0) {
        const statsMap = new Map(stats.map((s) => [s._id, s]));
        const updates = [];

        for (const c of courses) {
          const s = statsMap.get(c.slug);
          if (s && s.actCount > 0) {
            c.totalLectures = s.actCount;
            c.completedLectures = s.completedCount;
            c.totalMinutes = Math.round(s.totalEffort);
            c.completedMinutes = Math.round(s.completedEffort);
            c.totalHours = Math.round((s.totalEffort / 60) * 10) / 10;

            updates.push(
              Course.updateOne(
                { _id: c._id },
                {
                  $set: {
                    totalLectures: s.actCount,
                    completedLectures: s.completedCount,
                    totalMinutes: Math.round(s.totalEffort),
                    completedMinutes: Math.round(s.completedEffort),
                    totalHours: Math.round((s.totalEffort / 60) * 10) / 10,
                  },
                },
              ),
            );
          }
        }
        if (updates.length > 0) {
          await Promise.all(updates);
        }
      }
    } catch (aggErr) {
      console.warn(
        "[getCourses] Activity stats aggregation notice:",
        aggErr.message,
      );
    }

    return res.json({ success: true, count: courses.length, courses });
  } catch (err) {
    next(err);
  }
}

export async function createCourse(req, res, next) {
  try {
    const {
      title,
      slug,
      emoji = "📚",
      instructor = "",
      description = "",
      notes = "",
      category = "course",
      priority = "P2",
      defaultPracticeMultiplier = 2.0,
      startDate,
      targetDate,
      totalHours,
      totalLectures,
    } = req.body;
    if (!title || typeof title !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Course title is required." });
    }

    const courseSlug = (slug || title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const totalHoursNum = totalHours !== undefined && Number(totalHours) > 0 ? Number(totalHours) : 0;
    const totalMins = totalHoursNum > 0 ? Math.round(totalHoursNum * 60) : 0;
    const totalLecturesNum = totalLectures !== undefined && Number(totalLectures) > 0 ? Number(totalLectures) : 0;

    const existing = await Course.findOne({
      userId: req.user.id,
      slug: courseSlug,
    });
    if (existing) {
      existing.title = title.trim();
      if (emoji && typeof emoji === "string") existing.emoji = emoji.trim();
      existing.category = category || "course";
      if (instructor !== undefined) existing.instructor = instructor.trim();
      if (description !== undefined) existing.description = description.trim();
      if (notes !== undefined && typeof notes === "string") existing.notes = notes.trim();
      if (defaultPracticeMultiplier) existing.defaultPracticeMultiplier = Number(defaultPracticeMultiplier) || 2.0;
      if (startDate !== undefined) existing.startDate = startDate || null;
      if (targetDate !== undefined) existing.targetDate = targetDate || null;
      if (totalHoursNum > 0) {
        existing.totalHours = totalHoursNum;
        if (!existing.sections || existing.sections.length === 0) existing.totalMinutes = totalMins;
      }
      if (totalLecturesNum > 0 && (!existing.sections || existing.sections.length === 0)) {
        existing.totalLectures = totalLecturesNum;
      }
      existing.status = "active";
      existing.updatedAt = new Date();
      await existing.save();

      // Ensure stats match ground-truth activities if any exist
      await syncCourseFromActivities(req.user.id, courseSlug);

      return res.status(200).json({ success: true, course: existing, restored: true });
    }

    const course = await Course.create({
      userId: req.user.id,
      slug: courseSlug,
      title: title.trim(),
      emoji: emoji && typeof emoji === "string" ? emoji.trim() : "📚",
      category: category || "course",
      priority: ["P1", "P2", "P3"].includes(priority) ? priority : "P2",
      instructor: instructor.trim(),
      description: description.trim(),
      notes: notes && typeof notes === "string" ? notes.trim() : "",
      defaultPracticeMultiplier: Number(defaultPracticeMultiplier) || 2.0,
      startDate: startDate || null,
      targetDate: targetDate || null,
      totalHours: totalHoursNum,
      totalMinutes: totalMins,
      totalLectures: totalLecturesNum,
      status: "active",
      sections: [],
    });

    // Check if any activities were pre-existing for this slug and sync
    await syncCourseFromActivities(req.user.id, courseSlug);

    // If dates provided, auto-generate structured sessions and distribute timeline
    if (course.startDate && course.targetDate) {
      try {
        await runCourseTimelineDistribution(req.user.id, course);
      } catch (genErr) {
        console.warn("[createCourse] Timeline distribution notice:", genErr.message);
      }
    }

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (replanErr) {
      console.warn("[createCourse] Replan notice:", replanErr.message);
    }

    return res.status(201).json({ success: true, course });
  } catch (err) {
    next(err);
  }
}

export async function updateCourse(req, res, next) {
  try {
    const { slug } = req.params;
    const {
      title,
      emoji,
      instructor,
      description,
      notes,
      defaultPracticeMultiplier,
      priority,
      status,
      startDate,
      targetDate,
      category,
    } = req.body;

    const course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found." });
    }

    if (title !== undefined) course.title = title.trim();
    if (emoji !== undefined) course.emoji = emoji.trim() || "📚";
    if (category !== undefined) course.category = category;
    if (instructor !== undefined) course.instructor = instructor.trim();
    if (description !== undefined) course.description = description.trim();
    if (notes !== undefined) course.notes = notes.trim();
    if (priority !== undefined && ["P1", "P2", "P3"].includes(priority))
      course.priority = priority;
    const oldMultiplier = Number(course.defaultPracticeMultiplier) || 2;
    const newMultiplier =
      defaultPracticeMultiplier !== undefined
        ? Number(defaultPracticeMultiplier)
        : oldMultiplier;
    const multiplierChanged =
      defaultPracticeMultiplier !== undefined &&
      oldMultiplier !== newMultiplier;

    if (defaultPracticeMultiplier !== undefined)
      course.defaultPracticeMultiplier = newMultiplier;
    if (
      status !== undefined &&
      ["active", "paused", "archived"].includes(status)
    )
      course.status = status;
    if (startDate !== undefined) course.startDate = startDate;
    if (targetDate !== undefined) course.targetDate = targetDate;
    const actCount = await CurriculumActivity.countDocuments({
      userId: req.user.id,
      courseSlug: slug,
    });
    if (actCount > 0) {
      const allActs = await CurriculumActivity.find({
        userId: req.user.id,
        courseSlug: slug,
      });
      course.totalLectures = allActs.length;
      course.completedLectures = allActs.filter(
        (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
      ).length;
      course.totalMinutes = Math.round(
        allActs.reduce((s, a) => s + (a.totalEffortMinutes || 0), 0),
      );
      course.completedMinutes = Math.round(
        allActs
          .filter(
            (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
          )
          .reduce(
            (s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0),
            0,
          ),
      );
      course.totalHours = Math.round((course.totalMinutes / 60) * 10) / 10;
    } else {
      if (req.body.totalHours !== undefined) {
        course.totalHours = Number(req.body.totalHours) || 0;
        if (!course.sections || course.sections.length === 0) {
          course.totalMinutes = Math.round(course.totalHours * 60);
        }
      }
      if (req.body.totalLectures !== undefined) {
        course.totalLectures = Number(req.body.totalLectures) || 0;
      }
    }

    course.updatedAt = new Date();
    await course.save();

    if (multiplierChanged) {
      const future = await CurriculumActivity.find({
        userId: req.user.id,
        courseSlug: slug,
        status: { $ne: "completed" },
        activityMultiplierOverride: null,
        activityEffortOverrideMinutes: null,
      });

      if (future.length > 0) {
        const bulkOps = future.map((activity) => {
          const totalEffort = Math.round(
            (activity.contentDurationMinutes || 0) * newMultiplier,
          );
          const remaining = Math.max(
            0,
            totalEffort - (activity.actualMinutes || 0),
          );
          return {
            updateOne: {
              filter: { _id: activity._id },
              update: {
                $set: {
                  practiceMultiplier: newMultiplier,
                  totalEffortMinutes: totalEffort,
                  remainingMinutes: remaining,
                  updatedAt: new Date(),
                },
              },
            },
          };
        });
        await CurriculumActivity.bulkWrite(bulkOps);
      }

      // Recalculate course totals
      const allActs = await CurriculumActivity.find({
        userId: req.user.id,
        courseSlug: slug,
      });
      if (allActs.length > 0) {
        course.totalLectures = allActs.length;
        course.completedLectures = allActs.filter(
          (a) => a.status === "completed",
        ).length;
        course.totalMinutes = allActs.reduce(
          (s, a) => s + (a.totalEffortMinutes || 0),
          0,
        );
        course.completedMinutes = allActs
          .filter((a) => a.status === "completed")
          .reduce(
            (s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0),
            0,
          );
        await course.save();
      }
    }

    if (course.startDate && course.targetDate) {
      try {
        await runCourseTimelineDistribution(req.user.id, course);
      } catch (distErr) {
        console.warn("[updateCourse] Timeline distribution notice:", distErr.message);
      }
    }

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (replanErr) {
      console.warn("[updateCourse] Replan notice:", replanErr.message);
    }

    return res.json({ success: true, course });
  } catch (err) {
    next(err);
  }
}

export async function deleteCourse(req, res, next) {
  try {
    const { slug } = req.params;
    const course = await Course.findOneAndDelete({ userId: req.user.id, slug });
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found." });
    }

    // Keep execution history intact, archive pending activities
    await CurriculumActivity.updateMany(
      { userId: req.user.id, courseSlug: slug, status: { $ne: "completed" } },
      { $set: { status: "deferred" } },
    );

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (replanErr) {
      console.warn("[deleteCourse] Replan notice:", replanErr.message);
    }

    return res.json({
      success: true,
      message: `Course "${course.title}" deleted. Historical execution records preserved.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function previewImportDiff(req, res, next) {
  try {
    const { courseSlug, records } = req.body;
    if (!courseSlug || !records || !Array.isArray(records)) {
      return res
        .status(400)
        .json({
          success: false,
          error: "courseSlug and records array are required.",
        });
    }
    const diff = await CurriculumImporter.previewDiff({
      userId: req.user.id,
      courseSlug,
      records,
    });
    return res.json(diff);
  } catch (err) {
    next(err);
  }
}

export async function getCourseBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const course = await Course.findOne({ userId: req.user.id, slug });

    if (!course) {
      return res
        .status(404)
        .json({
          success: false,
          error: `Course "${slug}" not found. You can create or import it in Courses Hub.`,
        });
    }

    const activities = await CurriculumActivity.find({
      userId: req.user.id,
      courseSlug: slug,
    }).sort({ sectionNumber: 1, activityNumber: 1 });

    if (activities.length > 0) {
      const completed = activities.filter(
        (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
      ).length;
      const totalMin = Math.round(
        activities.reduce((s, a) => s + (a.totalEffortMinutes || 0), 0),
      );
      const completedMin = Math.round(
        activities
          .filter(
            (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
          )
          .reduce(
            (s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0),
            0,
          ),
      );

      if (
        course.totalLectures !== activities.length ||
        course.completedLectures !== completed ||
        course.totalMinutes !== totalMin ||
        course.completedMinutes !== completedMin
      ) {
        course.totalLectures = activities.length;
        course.completedLectures = completed;
        course.totalMinutes = totalMin;
        course.completedMinutes = completedMin;
        course.totalHours = Math.round((totalMin / 60) * 10) / 10;
        await course.save();
      }
    }

    const hierarchy = CurriculumImporter.buildHierarchyTree(
      activities,
      course.defaultPracticeMultiplier || 2,
    );

    return res.json({ success: true, course, activities, hierarchy });
  } catch (err) {
    next(err);
  }
}

export async function updateLectureProgress(req, res, next) {
  try {
    const { slug, lectureId } = req.params;
    const {
      isWatched,
      isCodeDone,
      problemsAttempted,
      problemsSolved,
      notes,
      difficulty,
      confidence,
    } = req.body;

    const course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found." });
    }

    let foundLecture = null;
    let foundSectionNumber = 1;
    for (const sec of course.sections) {
      const lec = sec.lectures.id(lectureId);
      if (lec) {
        foundSectionNumber = sec.sectionNumber || 1;
        if (isWatched !== undefined) lec.isWatched = Boolean(isWatched);
        if (isCodeDone !== undefined) lec.isCodeDone = Boolean(isCodeDone);
        if (req.body.isCompleted !== undefined) {
          lec.isWatched = Boolean(req.body.isCompleted);
          lec.isCodeDone = Boolean(req.body.isCompleted);
        }
        if (problemsAttempted !== undefined)
          lec.problemsAttempted = Number(problemsAttempted);
        if (problemsSolved !== undefined)
          lec.problemsSolved = Number(problemsSolved);
        if (notes !== undefined) lec.notes = notes;
        if (difficulty !== undefined) lec.difficulty = difficulty;
        if (confidence !== undefined) lec.confidence = Number(confidence);
        if (lec.isWatched && lec.isCodeDone && !lec.completedAt) {
          lec.completedAt = new Date();
        }
        foundLecture = lec;
        break;
      }
    }

    if (!foundLecture) {
      return res
        .status(404)
        .json({ success: false, error: "Lecture not found in course." });
    }

    course.recalculateProgress();
    if (
      course.totalLectures > 0 &&
      course.completedLectures >= course.totalLectures
    ) {
      course.status = "archived";
    } else if (
      course.status === "archived" &&
      course.completedLectures < course.totalLectures
    ) {
      course.status = "active";
    }
    await course.save();

    // Sync to normalized CurriculumActivity and Task
    try {
      const isDone = Boolean(foundLecture.isWatched && foundLecture.isCodeDone);
      const activity = await CurriculumActivity.findOneAndUpdate(
        {
          userId: req.user.id,
          courseSlug: slug,
          sectionNumber: foundSectionNumber,
          activityNumber: foundLecture.lectureNumber,
        },
        {
          $set: {
            isWatched: Boolean(foundLecture.isWatched),
            isCodeDone: Boolean(foundLecture.isCodeDone),
            status: isDone ? "completed" : "pending",
            completedAt: isDone ? foundLecture.completedAt || new Date() : null,
            ...(confidence !== undefined
              ? { confidence: Number(confidence) }
              : {}),
            ...(difficulty !== undefined ? { difficulty } : {}),
          },
        },
        { new: true },
      );

      // If activity has an associated Task, keep task completed/pending status synchronized
      if (activity && activity.taskId) {
        if (isDone) {
          await Task.updateOne(
            { _id: activity.taskId, userId: req.user.id },
            {
              $set: {
                status: "completed",
                remainingMinutes: 0,
                completedAt: foundLecture.completedAt || new Date(),
              },
            },
          );
        } else {
          await Task.updateOne(
            { _id: activity.taskId, userId: req.user.id },
            {
              $set: {
                status: "pending",
              },
            },
          );
        }
      }
    } catch (syncErr) {
      console.warn(
        "[courseController] CurriculumActivity sync notice:",
        syncErr.message,
      );
    }

    return res.json({
      success: true,
      message: "Lecture progress updated successfully.",
      lecture: foundLecture,
      courseProgress: {
        totalLectures: course.totalLectures,
        completedLectures: course.completedLectures,
        percent: Math.round(
          (course.completedLectures / (course.totalLectures || 1)) * 100,
        ),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function addCourseSection(req, res, next) {
  try {
    const { slug } = req.params;
    const { title, topics = [] } = req.body;
    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Section title is required." });
    }

    let course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      course = new Course({
        userId: req.user.id,
        slug,
        title:
          slug === "exploration-lab"
            ? "Exploration Lab (Section X)"
            : title.trim(),
        sections: [],
      });
    }

    const nextSecNum = (course.sections.length || 0) + 1;
    const lectures =
      Array.isArray(topics) && topics.length > 0
        ? topics
            .map((t, idx) => {
              const topicTitle =
                typeof t === "string"
                  ? t.trim()
                  : t.title || `Topic ${idx + 1}`;
              const duration =
                (typeof t === "object" && t.durationMinutes) || 45;
              return {
                lectureNumber: idx + 1,
                title: topicTitle,
                videoDurationMinutes: duration,
                practiceMultiplier: 1.0,
                totalEffortMinutes: duration,
                isWatched: false,
                isCodeDone: false,
              };
            })
            .filter((lec) => Boolean(lec.title))
        : [
            {
              lectureNumber: 1,
              title: "Core Fundamentals & Hands-on Practice",
              videoDurationMinutes: 45,
              practiceMultiplier: 1.0,
              totalEffortMinutes: 45,
              isWatched: false,
              isCodeDone: false,
            },
          ];

    course.sections.push({
      sectionNumber: nextSecNum,
      title: title.trim(),
      lectures,
    });

    course.recalculateProgress();
    if (
      course.totalLectures > 0 &&
      course.completedLectures >= course.totalLectures
    ) {
      course.status = "archived";
    } else if (
      course.status === "archived" &&
      course.completedLectures < course.totalLectures
    ) {
      course.status = "active";
    }
    await course.save();

    return res.status(201).json({ success: true, course });
  } catch (err) {
    next(err);
  }
}

export async function getOratoryWeeks(req, res, next) {
  try {
    try {
      await ensureOratoryTrack(req.user.id);
    } catch (trackErr) {
      console.warn("[getOratoryWeeks] ensureOratoryTrack notice:", trackErr.message);
    }

    const weeks = await OratoryWeek.find({ userId: req.user.id }).sort({
      weekNumber: 1,
    });
    return res.json({ success: true, count: weeks.length, weeks });
  } catch (err) {
    next(err);
  }
}

export async function createOratoryActivity(req, res, next) {
  try {
    const {
      topic,
      primarySkill = "Public Speaking",
      weekNumber,
      speechDraft,
      durationMinutes = 120,
      notes = "",
    } = req.body;
    if (!topic || !topic.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Topic is required." });
    }

    let targetWeek = Number(weekNumber);
    if (!targetWeek || targetWeek <= 0) {
      const latest = await OratoryWeek.findOne({ userId: req.user.id }).sort({
        weekNumber: -1,
      });
      targetWeek = (latest?.weekNumber || 0) + 1;
    }

    const week = await OratoryWeek.findOneAndUpdate(
      { userId: req.user.id, weekNumber: targetWeek },
      {
        userId: req.user.id,
        weekNumber: targetWeek,
        topic: topic.trim(),
        primarySkill: primarySkill.trim(),
        speechDraft: speechDraft || {},
        drillNotes: notes.trim(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Also register or update corresponding CurriculumActivity
    await CurriculumActivity.findOneAndUpdate(
      {
        userId: req.user.id,
        courseSlug: "oratory",
        activityNumber: targetWeek,
      },
      {
        userId: req.user.id,
        courseSlug: "oratory",
        courseTitle: "Oratory & Public Speaking",
        sectionNumber: 1,
        sectionTitle: "Speaking Practices",
        activityNumber: targetWeek,
        title: `Week ${targetWeek}: ${topic.trim()}`,
        description: `Primary Skill: ${primarySkill.trim()}`,
        contentDurationMinutes: 30,
        practiceMultiplier: 2.0,
        totalEffortMinutes: Number(durationMinutes) || 120,
        remainingMinutes: Number(durationMinutes) || 120,
        activityType: "speech",
        priority: "P2",
        notes: notes.trim(),
        status: "pending",
      },
      { upsert: true, new: true },
    );

    return res.status(201).json({ success: true, week });
  } catch (err) {
    next(err);
  }
}

export async function deleteOratoryActivity(req, res, next) {
  try {
    const { weekNumber } = req.params;
    const week = await OratoryWeek.findOneAndDelete({
      userId: req.user.id,
      weekNumber: Number(weekNumber),
    });
    if (!week) {
      return res
        .status(404)
        .json({ success: false, error: "Oratory week not found." });
    }
    await CurriculumActivity.deleteOne({
      userId: req.user.id,
      courseSlug: "oratory",
      activityNumber: Number(weekNumber),
    });
    return res.json({
      success: true,
      message: `Oratory Week ${weekNumber} deleted.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function createCourseActivity(req, res, next) {
  try {
    const { slug } = req.params;
    const {
      title,
      description = "",
      contentDurationMinutes = 0,
      estimatedExecutionMinutes,
      activityType = "lecture",
      priority = "P2",
      deadline,
      notes = "",
    } = req.body;

    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Activity title is required." });
    }

    let course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: `Course "${slug}" not found.` });
    }

    const latestAct = await CurriculumActivity.findOne({
      userId: req.user.id,
      courseSlug: slug,
    }).sort({ activityNumber: -1 });
    const activityNumber = (latestAct?.activityNumber || 0) + 1;

    const contentDur = Number(contentDurationMinutes) || 0;
    const multiplier = course.defaultPracticeMultiplier || 2.0;
    const estEffort =
      Number(estimatedExecutionMinutes) ||
      (contentDur > 0 ? Math.round(contentDur * multiplier) : 45);

    const validTypes = [
      "lecture",
      "problem",
      "project",
      "reading",
      "speech",
      "exercise",
      "exploration",
      "research",
    ];
    const chosenType = validTypes.includes(activityType.toLowerCase())
      ? activityType.toLowerCase()
      : "lecture";

    const activity = await CurriculumActivity.create({
      userId: req.user.id,
      courseSlug: slug,
      courseTitle: course.title,
      sectionNumber: 1,
      sectionTitle: "Curriculum Activities",
      activityNumber,
      title: title.trim(),
      description: description.trim(),
      contentDurationMinutes: contentDur,
      practiceMultiplier: multiplier,
      totalEffortMinutes: estEffort,
      actualMinutes: 0,
      remainingMinutes: estEffort,
      activityType: chosenType,
      priority: ["P1", "P2", "P3"].includes(priority) ? priority : "P2",
      deadline: deadline || null,
      notes: notes.trim(),
      status: "pending",
    });

    // Update course metadata accurately from ground-truth
    await syncCourseFromActivities(req.user.id, slug);

    return res.status(201).json({ success: true, activity });
  } catch (err) {
    next(err);
  }
}

export async function logCourseSession(req, res, next) {
  try {
    const { slug } = req.params;
    const {
      minutesSpent,
      notes = "",
      date,
      title,
      isCompleted = false,
    } = req.body;

    if (!minutesSpent || Number(minutesSpent) <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Valid minutesSpent (> 0) is required.",
        });
    }

    const course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: `Course "${slug}" not found.` });
    }

    const result = await ExecutionSyncService.recordWork({
      userId: req.user.id,
      courseSlug: slug,
      minutesSpent: Number(minutesSpent),
      date: date || new Date().toISOString().split("T")[0],
      type: "regular",
      notes: notes.trim(),
      isCompleted: Boolean(isCompleted),
    });

    await syncCourseFromActivities(req.user.id, slug);

    return res.status(201).json({
      success: true,
      message: `Recorded ${minutesSpent} min of execution on ${course.title}.`,
      executionRecord: result.executionRecord,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOratoryWeek(req, res, next) {
  try {
    const { weekNumber } = req.params;
    const updates = { ...req.body };
    delete updates.userId;
    delete updates.weekNumber;

    const week = await OratoryWeek.findOne({
      userId: req.user.id,
      weekNumber: Number(weekNumber),
    });
    if (!week) {
      return res
        .status(404)
        .json({
          success: false,
          error: `Oratory Week ${weekNumber} not found.`,
        });
    }

    if (updates.speechDraft)
      week.speechDraft = { ...week.speechDraft, ...updates.speechDraft };
    if (updates.scores) week.scores = { ...week.scores, ...updates.scores };
    if (updates.biggestMistake !== undefined)
      week.biggestMistake = updates.biggestMistake;
    if (updates.drillNotes !== undefined) week.drillNotes = updates.drillNotes;
    if (updates.firstRecordingNotes !== undefined)
      week.firstRecordingNotes = updates.firstRecordingNotes;
    if (updates.finalRecordingNotes !== undefined)
      week.finalRecordingNotes = updates.finalRecordingNotes;
    if (updates.comparisonSummary !== undefined)
      week.comparisonSummary = updates.comparisonSummary;
    if (updates.isCompleted !== undefined) {
      week.isCompleted = Boolean(updates.isCompleted);
      if (week.isCompleted && !week.completedAt) week.completedAt = new Date();
      if (!week.isCompleted) week.completedAt = null;

      // Two-way sync: Update matching CurriculumActivity and Course
      try {
        await CurriculumActivity.findOneAndUpdate(
          {
            userId: req.user.id,
            courseSlug: "oratory",
            activityNumber: Number(weekNumber),
          },
          {
            $set: {
              status: week.isCompleted ? "completed" : "pending",
              isWatched: week.isCompleted,
              isCodeDone: week.isCompleted,
              actualMinutes: week.isCompleted ? 45 : 0,
              remainingMinutes: week.isCompleted ? 0 : 45,
              completedAt: week.completedAt,
              updatedAt: new Date(),
            },
          },
        );
        await syncCourseFromActivities(req.user.id, "oratory");
      } catch (syncErr) {
        console.warn("[updateOratoryWeek] activity sync notice:", syncErr.message);
      }
    }

    week.updatedAt = new Date();
    await week.save();

    return res.json({ success: true, week });
  } catch (err) {
    next(err);
  }
}

export async function downloadCsvTemplate(req, res, next) {
  try {
    const kind =
      req.query.kind ||
      (req.path && req.path.includes("oratory") ? "oratory" : "course");
    const csv = CurriculumImporter.generateCsvTemplate(kind);
    const filename =
      kind === "oratory"
        ? "sarthi_oratory_template.csv"
        : kind === "exploration"
          ? "sarthi_exploration_template.csv"
          : "sarthi_curriculum_template.csv";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

export async function previewCsvImport(req, res, next) {
  try {
    const { csvText } = req.body;
    if (!csvText || typeof csvText !== "string") {
      return res
        .status(400)
        .json({
          success: false,
          error: "csvText string is required in request body.",
        });
    }
    const { courseSlug, category = "course" } = req.body;
    const existingCourse = courseSlug
      ? await Course.findOne({ userId: req.user.id, slug: courseSlug })
      : null;
    const setting = existingCourse
      ? null
      : await Setting.findOne({ userId: req.user.id });
    const existingActivities = courseSlug
      ? await CurriculumActivity.find({ userId: req.user.id, courseSlug })
          .select("activityNumber")
          .lean()
      : [];
    const multiplier = Number(
      existingCourse?.defaultPracticeMultiplier ||
        setting?.defaultPracticeMultiplier ||
        2,
    );
    const result = CurriculumImporter.parseCsv(csvText, multiplier, {
      existingActivityNumbers: existingActivities.map((a) => a.activityNumber),
    });
    if (
      result.courseName &&
      existingCourse &&
      result.courseName !== existingCourse.title
    )
      result.warnings.push(
        `CSV course_name '${result.courseName}' differs from configured course '${existingCourse.title}'; configured course settings are retained.`,
      );
    result.category = category;
    result.courseSlug = courseSlug || null;
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function commitCsvImport(req, res, next) {
  try {
    const { courseSlug, courseTitle, records, category = "course" } = req.body;
    if (!courseSlug || !records || !Array.isArray(records)) {
      return res
        .status(400)
        .json({
          success: false,
          error: "courseSlug and records array are required.",
        });
    }
    const result = await CurriculumImporter.commitCourse({
      userId: req.user.id,
      courseSlug,
      courseTitle: courseTitle || courseSlug,
      records,
      defaultMultiplier:
        Number(
          (await Course.findOne({ userId: req.user.id, slug: courseSlug }))
            ?.defaultPracticeMultiplier,
        ) ||
        Number(
          (await Setting.findOne({ userId: req.user.id }))
            ?.defaultPracticeMultiplier,
        ) ||
        2,
      category,
    });

    if (courseSlug === "oratory") {
      for (const rec of records) {
        await OratoryWeek.findOneAndUpdate(
          { userId: req.user.id, weekNumber: rec.serialNumber },
          {
            userId: req.user.id,
            weekNumber: rec.serialNumber,
            topic: rec.title.replace(/^Week \d+:\s*/i, ""),
            primarySkill: rec.notes || rec.description || "Public Speaking",
          },
          { upsert: true, new: true },
        );
      }
    }

    // Auto-distribute timeline if course has startDate and targetDate configured
    let distribution = null;
    try {
      const courseRecord = await Course.findOne({ userId: req.user.id, slug: courseSlug });
      if (courseRecord && courseRecord.startDate && courseRecord.targetDate) {
        distribution = await runCourseTimelineDistribution(req.user.id, courseRecord);
      }
    } catch (distErr) {
      console.warn("Timeline auto-distribution warning on CSV commit:", distErr.message);
    }

    // Keep parent course stats 100% synchronized
    await syncCourseFromActivities(req.user.id, courseSlug);

    return res.json({ success: true, ...result, distribution });
  } catch (err) {
    next(err);
  }
}

export async function getCourseActivities(req, res, next) {
  try {
    const { slug } = req.params;
    let activities = await CurriculumActivity.find({
      userId: req.user.id,
      courseSlug: slug,
    }).sort({ sectionNumber: 1, activityNumber: 1 });

    // Auto-migrate if 0 activities exist yet
    if (activities.length === 0) {
      await migrateCoursesToActivities(req.user.id);
      activities = await CurriculumActivity.find({
        userId: req.user.id,
        courseSlug: slug,
      }).sort({ sectionNumber: 1, activityNumber: 1 });
    }

    const hierarchy = CurriculumImporter.buildHierarchyTree(activities);
    return res.json({
      success: true,
      count: activities.length,
      activities,
      hierarchy,
    });
  } catch (err) {
    next(err);
  }
}

export async function completeCourseActivity(req, res, next) {
  try {
    const { id } = req.params;
    const { actualMinutes, confidence, status, operationId } = req.body;
    const opId = operationId || req.headers["x-operation-id"] || null;

    if (status === "pending") {
      const act = await CurriculumActivity.findOne({
        _id: id,
        userId: req.user.id,
      });
      if (!act)
        return res
          .status(404)
          .json({ success: false, error: "Activity not found." });

      act.status = "pending";
      act.isWatched = false;
      act.isCodeDone = false;
      act.actualMinutes = 0;
      act.remainingMinutes = act.totalEffortMinutes || 30;
      act.completedAt = null;
      await act.save();

      const course = await Course.findOne({
        userId: req.user.id,
        slug: act.courseSlug,
      });
      if (course) {
        if (Array.isArray(course.sections)) {
          for (const sec of course.sections) {
            if (sec.sectionNumber === act.sectionNumber) {
              const lec = sec.lectures?.find(
                (l) => l.lectureNumber === act.activityNumber,
              );
              if (lec) {
                lec.isWatched = false;
                lec.isCodeDone = false;
                lec.completedAt = null;
                break;
              }
            }
          }
        }
        const allActs = await CurriculumActivity.find({
          userId: req.user.id,
          courseSlug: act.courseSlug,
        });
        if (allActs.length > 0) {
          course.totalLectures = allActs.length;
          course.completedLectures = allActs.filter(
            (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
          ).length;
          course.totalMinutes = allActs.reduce(
            (s, a) => s + (a.totalEffortMinutes || 0),
            0,
          );
          course.completedMinutes = allActs
            .filter(
              (a) => a.status === "completed" || (a.isWatched && a.isCodeDone),
            )
            .reduce(
              (s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0),
              0,
            );
        }
        if (
          course.status === "archived" &&
          course.completedLectures < course.totalLectures
        ) {
          course.status = "active";
        }
        await course.save();
      }

      if (act.courseSlug === "oratory") {
        try {
          await OratoryWeek.findOneAndUpdate(
            { userId: req.user.id, weekNumber: act.activityNumber },
            {
              $set: {
                isCompleted: false,
                completedAt: null,
                updatedAt: new Date(),
              },
            },
          );
        } catch (orErr) {
          console.warn("[completeCourseActivity] OratoryWeek uncomplete notice:", orErr.message);
        }
      }

      await syncCourseFromActivities(req.user.id, act.courseSlug);
      return res.json({ success: true, activity: act });
    }

    const activity = await ExecutionSyncService.completeActivity({
      userId: req.user.id,
      activityId: id,
      actualMinutes,
      confidence,
      operationId: opId,
    });
    if (!activity) {
      return res
        .status(404)
        .json({ success: false, error: "Activity not found." });
    }
    await syncCourseFromActivities(req.user.id, activity.courseSlug);
    return res.json({ success: true, activity });
  } catch (err) {
    next(err);
  }
}

export async function logPartialCourseActivity(req, res, next) {
  try {
    const { id } = req.params;
    const { minutesSpent, notes = "", date, operationId } = req.body;
    const opId = operationId || req.headers["x-operation-id"] || null;
    const activity = await CurriculumActivity.findOne({
      _id: id,
      userId: req.user.id,
    });
    if (!activity) {
      return res
        .status(404)
        .json({ success: false, error: "Activity not found." });
    }

    const minutes = Number(minutesSpent) || 0;
    if (minutes <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Minutes spent must be greater than 0." });
    }

    const result = await ExecutionSyncService.recordWork({
      userId: req.user.id,
      activityId: activity._id,
      taskId: activity.taskId,
      courseSlug: activity.courseSlug,
      minutesSpent: minutes,
      notes,
      date: date || getTodayString(),
      isCompleted: false,
      operationId: opId,
    });

    await syncCourseFromActivities(req.user.id, activity.courseSlug);

    return res.json({
      success: true,
      activity: result.activity,
      executionRecord: result.executionRecord,
      isDuplicate: Boolean(result.isDuplicate),
    });
  } catch (err) {
    next(err);
  }
}

export async function distributeCourse(req, res, next) {
  try {
    const { slug } = req.params;
    const { startDate, targetDate, dailyStudyMinutes, multiplier } = req.body;
    const course = await Course.findOne({ slug, userId: req.user.id });
    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found." });
    }

    if (startDate) course.startDate = startDate;
    if (targetDate) course.targetDate = targetDate;
    if (multiplier && Number(multiplier) > 0) course.defaultPracticeMultiplier = Number(multiplier);
    await course.save();

    const distribution = await runCourseTimelineDistribution(req.user.id, course);
    let allocationRes = null;
    try {
      allocationRes = await AllocationService.replanFrom(req.user.id, course.startDate || getTodayString());
    } catch (allocErr) {
      console.warn("[distributeCourse] AllocationService notice:", allocErr.message);
    }

    return res.json({
      success: true,
      course,
      distribution,
      feasibility: allocationRes?.feasibility,
      slackProposal: allocationRes?.slackProposal,
    });
  } catch (err) {
    next(err);
  }
}
