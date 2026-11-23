import { Course } from '../models/Course.js';
import { CurriculumActivity } from '../models/CurriculumActivity.js';
import { ExecutionRecord } from '../models/ExecutionRecord.js';

export async function cleanLegacySeededCourses(userId) {
  // Safe no-op: user-created courses must never be deleted automatically based on title or slug
  return;
}

export async function cleanTemporaryTestCourses(userId) {
  return cleanLegacySeededCourses(userId);
}

export async function migrateCoursesToActivities(userId) {
  await cleanLegacySeededCourses(userId);
  const courses = await Course.find({ userId });
  let migratedCount = 0;

  for (const course of courses) {
    if (!Array.isArray(course.sections)) continue;

    for (const sec of course.sections) {
      if (!Array.isArray(sec.lectures)) continue;

      for (const lec of sec.lectures) {
        const existing = await CurriculumActivity.findOne({
          userId,
          courseSlug: course.slug,
          sectionNumber: sec.sectionNumber,
          activityNumber: lec.lectureNumber
        });

        if (!existing) {
          const effort = lec.totalEffortMinutes || Math.round((lec.videoDurationMinutes || 10) * (lec.practiceMultiplier || 1.6));
          const isDone = Boolean(lec.isWatched && lec.isCodeDone);

          await CurriculumActivity.create({
            userId,
            courseSlug: course.slug,
            courseTitle: course.title,
            sectionNumber: sec.sectionNumber,
            sectionTitle: sec.title || `Section ${sec.sectionNumber}`,
            activityNumber: lec.lectureNumber,
            title: lec.title,
            contentDurationMinutes: lec.videoDurationMinutes || 0,
            practiceMultiplier: lec.practiceMultiplier || 1.6,
            totalEffortMinutes: effort,
            activityType: course.slug === 'dsa' ? 'problem' : 'lecture',
            priority: 'P2',
            difficulty: lec.difficulty || 'medium',
            confidence: lec.confidence || 3,
            isWatched: Boolean(lec.isWatched),
            isCodeDone: Boolean(lec.isCodeDone),
            status: isDone ? 'completed' : 'pending',
            completedAt: isDone ? (lec.completedAt || new Date()) : null
          });
          migratedCount++;
        }
      }
    }
  }

  return migratedCount;
}
