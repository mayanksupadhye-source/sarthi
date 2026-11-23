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
import {
  parseWebDevMarkdown,
  parseDSAMarkdown,
  getOratoryWeeksSeed,
} from "../services/courseSeeder.js";

export async function getCourses(req, res, next) {
  try {
    const filter = { userId: req.user.id };
    if (req.query.category) {
      filter.category = req.query.category;
    }
    const courses = await Course.find(filter).select(
      "slug title emoji category priority instructor description notes defaultPracticeMultiplier status startDate targetDate totalLectures completedLectures totalMinutes completedMinutes",
    );
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

    const existing = await Course.findOne({
      userId: req.user.id,
      slug: courseSlug,
    });
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          error: `A course with slug "${courseSlug}" already exists.`,
        });
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
      status: "active",
      sections: [],
    });

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
    } = req.body;

    const course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found." });
    }

    if (title !== undefined) course.title = title.trim();
    if (emoji !== undefined) course.emoji = emoji.trim() || "📚";
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
    for (const sec of course.sections) {
      const lec = sec.lectures.id(lectureId);
      if (lec) {
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

    // Sync to normalized CurriculumActivity if it exists
    try {
      const isDone = Boolean(foundLecture.isWatched && foundLecture.isCodeDone);
      await CurriculumActivity.updateOne(
        {
          userId: req.user.id,
          courseSlug: slug,
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
      );
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
    let weeks = await OratoryWeek.find({ userId: req.user.id }).sort({
      weekNumber: 1,
    });
    if (weeks.length === 0) {
      // Auto-sync from CurriculumActivity if activities exist
      const activities = await CurriculumActivity.find({
        userId: req.user.id,
        courseSlug: "oratory",
      }).sort({ activityNumber: 1 });
      if (activities.length > 0) {
        for (const act of activities) {
          await OratoryWeek.findOneAndUpdate(
            { userId: req.user.id, weekNumber: act.activityNumber },
            {
              userId: req.user.id,
              weekNumber: act.activityNumber,
              topic: act.title.replace(/^Week \d+:\s*/i, ""),
              primarySkill:
                act.description.replace(/^Primary Skill:\s*/i, "") ||
                "Public Speaking",
              isCompleted: act.status === "completed",
              completedAt: act.completedAt,
            },
            { upsert: true, new: true },
          );
        }
        weeks = await OratoryWeek.find({ userId: req.user.id }).sort({
          weekNumber: 1,
        });
      }
    }
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

    // Update course metadata
    course.totalLectures = (course.totalLectures || 0) + 1;
    course.totalMinutes = (course.totalMinutes || 0) + estEffort;
    await course.save();

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
        const activities = await CurriculumActivity.find({
          userId: req.user.id,
          courseSlug,
        }).sort({ orderIndex: 1, sequenceOrder: 1, createdAt: 1 });

        distribution = await PlannerEngine.distributeCourseTimeline({
          course: courseRecord,
          activities,
          userId: req.user.id,
          startDate: courseRecord.startDate,
          targetDate: courseRecord.targetDate,
          multiplier: courseRecord.defaultPracticeMultiplier || 2.0,
        });

        if (distribution && distribution.allocations && distribution.allocations.length > 0) {
          const actOps = distribution.allocations.map((alloc) => ({
            updateOne: {
              filter: { _id: alloc.activityId, userId: req.user.id },
              update: { $set: { scheduledDate: alloc.scheduledDate } },
            },
          }));
          await CurriculumActivity.bulkWrite(actOps);
        }
      }
    } catch (distErr) {
      console.warn("Timeline auto-distribution warning on CSV commit:", distErr.message);
    }

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
    const { actualMinutes, confidence, status } = req.body;

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
      return res.json({ success: true, activity: act });
    }

    const activity = await ExecutionSyncService.completeActivity({
      userId: req.user.id,
      activityId: id,
      actualMinutes,
      confidence,
    });
    if (!activity) {
      return res
        .status(404)
        .json({ success: false, error: "Activity not found." });
    }
    return res.json({ success: true, activity });
  } catch (err) {
    next(err);
  }
}

export async function logPartialCourseActivity(req, res, next) {
  try {
    const { id } = req.params;
    const { minutesSpent, notes = "", date } = req.body;
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
    });

    return res.json({
      success: true,
      activity: result.activity,
      executionRecord: result.executionRecord,
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

    const activities = await CurriculumActivity.find({
      userId: req.user.id,
      courseSlug: slug,
    }).sort({ orderIndex: 1, sequenceOrder: 1, createdAt: 1 });

    const distribution = await PlannerEngine.distributeCourseTimeline({
      course,
      activities,
      userId: req.user.id,
      startDate: course.startDate || startDate,
      targetDate: course.targetDate || targetDate,
      dailyStudyMinutes: dailyStudyMinutes ? Number(dailyStudyMinutes) : null,
      multiplier: course.defaultPracticeMultiplier || multiplier,
    });

    if (distribution.allocations && distribution.allocations.length > 0) {
      const actOps = distribution.allocations.map((alloc) => ({
        updateOne: {
          filter: { _id: alloc.activityId, userId: req.user.id },
          update: { $set: { scheduledDate: alloc.scheduledDate } },
        },
      }));
      await CurriculumActivity.bulkWrite(actOps);

      const allocatedActIds = distribution.allocations.map((a) => a.activityId);
      const allocatedActs = await CurriculumActivity.find({
        _id: { $in: allocatedActIds },
        userId: req.user.id,
        taskId: { $ne: null },
      }).select("taskId scheduledDate");

      if (allocatedActs.length > 0) {
        const taskOps = allocatedActs.map((a) => ({
          updateOne: {
            filter: { _id: a.taskId, userId: req.user.id },
            update: { $set: { scheduledDate: a.scheduledDate } },
          },
        }));
        await Task.bulkWrite(taskOps);
      }
    }

    return res.json({
      success: true,
      course,
      distribution,
    });
  } catch (err) {
    next(err);
  }
}
