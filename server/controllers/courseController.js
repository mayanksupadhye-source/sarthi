import { Course } from '../models/Course.js';
import { OratoryWeek } from '../models/OratoryWeek.js';
import { parseWebDevMarkdown, parseDSAMarkdown, getOratoryWeeksSeed } from '../services/courseSeeder.js';

export async function getCourses(req, res, next) {
  try {
    const courses = await Course.find({ userId: req.user.id }).select('slug title instructor totalLectures completedLectures totalMinutes completedMinutes');
    return res.json({ success: true, courses });
  } catch (err) {
    next(err);
  }
}

export async function getCourseBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    let course = await Course.findOne({ userId: req.user.id, slug });

    // Auto-seed if missing
    if (!course) {
      if (slug === 'web-dev') {
        const data = parseWebDevMarkdown();
        if (data) {
          course = new Course({ ...data, userId: req.user.id });
          course.recalculateProgress();
          await course.save();
        }
      } else if (slug === 'dsa') {
        const data = parseDSAMarkdown();
        if (data) {
          course = new Course({ ...data, userId: req.user.id });
          course.recalculateProgress();
          await course.save();
        }
      } else if (slug === 'exploration-lab' || slug === 'explore') {
        course = new Course({
          userId: req.user.id,
          slug: 'exploration-lab',
          title: 'Exploration Lab (Section X)',
          instructor: 'Self-Directed Mastery',
          description: 'Dedicated space for secondary exploratory skills — Advanced Excel, Financial Modelling, PowerPoint Deck Design, Linux Command Line, and emerging tools.',
          defaultPracticeMultiplier: 1.0,
          sections: [
            {
              sectionNumber: 1,
              title: 'Advanced Excel & Financial Modelling',
              lectures: [
                { lectureNumber: 1, title: 'VLOOKUP vs XLOOKUP in Real Financial Models', videoDurationMinutes: 45, practiceMultiplier: 1.0, totalEffortMinutes: 45 },
                { lectureNumber: 2, title: 'INDEX-MATCH & Dynamic Array Formulas', videoDurationMinutes: 40, practiceMultiplier: 1.0, totalEffortMinutes: 40 },
                { lectureNumber: 3, title: 'Pivot Tables, Slicers & Summary Dashboards', videoDurationMinutes: 50, practiceMultiplier: 1.0, totalEffortMinutes: 50 },
                { lectureNumber: 4, title: 'Discounted Cash Flow (DCF) & Valuation Models', videoDurationMinutes: 60, practiceMultiplier: 1.0, totalEffortMinutes: 60 },
                { lectureNumber: 5, title: 'Macro Basics & Automation Scripting', videoDurationMinutes: 45, practiceMultiplier: 1.0, totalEffortMinutes: 45 }
              ]
            },
            {
              sectionNumber: 2,
              title: 'Executive Presentation & Pitch Decks',
              lectures: [
                { lectureNumber: 1, title: 'Information Hierarchy & The 3-Second Rule', videoDurationMinutes: 30, practiceMultiplier: 1.0, totalEffortMinutes: 30 },
                { lectureNumber: 2, title: 'Typography Systems & Visual Contrast in Slides', videoDurationMinutes: 35, practiceMultiplier: 1.0, totalEffortMinutes: 35 },
                { lectureNumber: 3, title: 'Visual Storytelling & Chart Simplification', videoDurationMinutes: 40, practiceMultiplier: 1.0, totalEffortMinutes: 40 },
                { lectureNumber: 4, title: 'Executive Pitch Deck Architecture (10-Slide Deck)', videoDurationMinutes: 45, practiceMultiplier: 1.0, totalEffortMinutes: 45 }
              ]
            },
            {
              sectionNumber: 3,
              title: 'Linux & Shell Scripting',
              lectures: [
                { lectureNumber: 1, title: 'Essential Bash Navigation, Permissions & File Operations', videoDurationMinutes: 40, practiceMultiplier: 1.0, totalEffortMinutes: 40 },
                { lectureNumber: 2, title: 'Piping, Redirection & Text Filtering (grep, sed, awk)', videoDurationMinutes: 50, practiceMultiplier: 1.0, totalEffortMinutes: 50 },
                { lectureNumber: 3, title: 'Writing Resilient Bash Automation Scripts', videoDurationMinutes: 45, practiceMultiplier: 1.0, totalEffortMinutes: 45 },
                { lectureNumber: 4, title: 'Process Management, SSH & Cron Jobs', videoDurationMinutes: 45, practiceMultiplier: 1.0, totalEffortMinutes: 45 }
              ]
            }
          ]
        });
        course.recalculateProgress();
        await course.save();
      }
    }

    if (!course) {
      return res.status(404).json({ success: false, error: `Course "${slug}" not found.` });
    }

    return res.json({ success: true, course });
  } catch (err) {
    next(err);
  }
}

export async function updateLectureProgress(req, res, next) {
  try {
    const { slug, lectureId } = req.params;
    const { isWatched, isCodeDone, problemsAttempted, problemsSolved, notes, difficulty, confidence } = req.body;

    const course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found.' });
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
        if (problemsAttempted !== undefined) lec.problemsAttempted = Number(problemsAttempted);
        if (problemsSolved !== undefined) lec.problemsSolved = Number(problemsSolved);
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
      return res.status(404).json({ success: false, error: 'Lecture not found in course.' });
    }

    course.recalculateProgress();
    await course.save();

    return res.json({
      success: true,
      message: 'Lecture progress updated successfully.',
      lecture: foundLecture,
      courseProgress: {
        totalLectures: course.totalLectures,
        completedLectures: course.completedLectures,
        percent: Math.round((course.completedLectures / (course.totalLectures || 1)) * 100)
      }
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
      return res.status(400).json({ success: false, error: 'Section title is required.' });
    }

    let course = await Course.findOne({ userId: req.user.id, slug });
    if (!course) {
      course = new Course({
        userId: req.user.id,
        slug,
        title: slug === 'exploration-lab' ? 'Exploration Lab (Section X)' : title.trim(),
        sections: []
      });
    }

    const nextSecNum = (course.sections.length || 0) + 1;
    const lectures = Array.isArray(topics) && topics.length > 0
      ? topics.map((t, idx) => {
          const topicTitle = typeof t === 'string' ? t.trim() : (t.title || `Topic ${idx + 1}`);
          const duration = (typeof t === 'object' && t.durationMinutes) || 45;
          return {
            lectureNumber: idx + 1,
            title: topicTitle,
            videoDurationMinutes: duration,
            practiceMultiplier: 1.0,
            totalEffortMinutes: duration,
            isWatched: false,
            isCodeDone: false
          };
        }).filter(lec => Boolean(lec.title))
      : [
          {
            lectureNumber: 1,
            title: 'Core Fundamentals & Hands-on Practice',
            videoDurationMinutes: 45,
            practiceMultiplier: 1.0,
            totalEffortMinutes: 45,
            isWatched: false,
            isCodeDone: false
          }
        ];

    course.sections.push({
      sectionNumber: nextSecNum,
      title: title.trim(),
      lectures
    });

    course.recalculateProgress();
    await course.save();

    return res.status(201).json({ success: true, course });
  } catch (err) {
    next(err);
  }
}

export async function getOratoryWeeks(req, res, next) {
  try {
    let weeks = await OratoryWeek.find({ userId: req.user.id }).sort({ weekNumber: 1 });
    if (weeks.length === 0) {
      const seed = getOratoryWeeksSeed().map(w => ({ ...w, userId: req.user.id }));
      weeks = await OratoryWeek.insertMany(seed);
    }
    return res.json({ success: true, count: weeks.length, weeks });
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

    const week = await OratoryWeek.findOne({ userId: req.user.id, weekNumber: Number(weekNumber) });
    if (!week) {
      return res.status(404).json({ success: false, error: `Oratory Week ${weekNumber} not found.` });
    }

    if (updates.speechDraft) week.speechDraft = { ...week.speechDraft, ...updates.speechDraft };
    if (updates.scores) week.scores = { ...week.scores, ...updates.scores };
    if (updates.biggestMistake !== undefined) week.biggestMistake = updates.biggestMistake;
    if (updates.drillNotes !== undefined) week.drillNotes = updates.drillNotes;
    if (updates.firstRecordingNotes !== undefined) week.firstRecordingNotes = updates.firstRecordingNotes;
    if (updates.finalRecordingNotes !== undefined) week.finalRecordingNotes = updates.finalRecordingNotes;
    if (updates.comparisonSummary !== undefined) week.comparisonSummary = updates.comparisonSummary;
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
