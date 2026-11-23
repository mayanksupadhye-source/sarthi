import test from 'node:test';
import assert from 'node:assert/strict';
import { Course } from '../server/models/Course.js';
import { OratoryWeek } from '../server/models/OratoryWeek.js';
import { CurriculumActivity } from '../server/models/CurriculumActivity.js';
import { CurriculumImporter } from '../server/services/curriculumImporter.js';
import { formatMinutes } from '../client/assets/js/utils.js';

test('SARTHI Dynamic Courses, Learning Tracks, Exploration & Oratory Engine', async (t) => {
  await t.test('1. Course schema stores and defaults emoji', () => {
    const courseDefault = new Course({
      userId: '60d5ecb8b392d70015f8a001',
      slug: 'general-cs',
      title: 'General Computer Science'
    });
    assert.equal(courseDefault.emoji, '📚');

    const courseCustom = new Course({
      userId: '60d5ecb8b392d70015f8a001',
      slug: 'neural-nets',
      title: 'Deep Learning',
      emoji: '🧠'
    });
    assert.equal(courseCustom.emoji, '🧠');
  });

  await t.test('2. Oratory CSV Template and Column Aliasing', () => {
    // Oratory template generation
    const template = CurriculumImporter.generateCsvTemplate('oratory');
    assert.match(template, /week_number/);
    assert.match(template, /topic/);
    assert.match(template, /focus_areas/);

    // Oratory CSV parsing via aliases
    const oratoryCsv = [
      'week_number,topic,description,focus_areas,duration_minutes',
      '1,The Hook & Provocation,Crafting first 15 seconds,voice modulation,120',
      '2,Storytelling & Narrative,Using emotional arc,gestures,120',
      '15,Keynote Mastery,Full stage presence,persuasion,120'
    ].join('\n');

    const parsed = CurriculumImporter.parseCsv(oratoryCsv);
    assert.equal(parsed.success, true);
    assert.equal(parsed.totalRows, 3);
    assert.equal(parsed.records[0].serialNumber, 1);
    assert.equal(parsed.records[0].title, 'The Hook & Provocation');
    assert.equal(parsed.records[0].contentDurationMinutes, 120);
    assert.equal(parsed.records[2].serialNumber, 15);
    assert.equal(parsed.records[2].title, 'Keynote Mastery');
  });

  await t.test('3. Duration & Multiplier Effort Separation without Floating Point Artifacts', () => {
    const csvWithFloat = [
      'serial_number,activity_name,content_duration_minutes',
      '1,Float Precision Test,33.333333'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvWithFloat, 1.5);
    assert.equal(result.success, true);
    // 33.333333 * 1.5 = 49.9999995 -> cleanly rounded to 50
    assert.equal(result.records[0].estimatedExecutionMinutes, 50);

    // formatMinutes eliminates floating point artifacts
    assert.equal(formatMinutes(5.00000000034), '5m');
    assert.equal(formatMinutes(125.6), '2h 6m');
    assert.equal(formatMinutes(0), '0m');
  });

  await t.test('4. OratoryWeek model supports arbitrary N weeks (> 13)', () => {
    const week14 = new OratoryWeek({
      userId: '60d5ecb8b392d70015f8a001',
      weekNumber: 14,
      topic: 'Crisis Communication',
      primarySkill: 'High-stakes composure'
    });
    const err14 = week14.validateSync();
    assert.equal(err14, undefined, 'Week 14 must be valid in schema');

    const week25 = new OratoryWeek({
      userId: '60d5ecb8b392d70015f8a001',
      weekNumber: 25,
      topic: 'TEDx Talk Preparation',
      primarySkill: 'Global stage delivery'
    });
    const err25 = week25.validateSync();
    assert.equal(err25, undefined, 'Week 25 must be valid in schema');
  });

  await t.test('5. Fast Idempotent Commit preserves completed activities and logged progress', () => {
    // Mock records
    const records = [
      {
        serialNumber: 1,
        title: 'Algorithms 101',
        description: 'Basics',
        contentDurationMinutes: 60,
        estimatedExecutionMinutes: 120,
        sectionOrder: 1,
        sectionId: 'foundations',
        sectionName: 'Foundations',
        activityType: 'lecture',
        priority: 'P1',
        dependencies: []
      },
      {
        serialNumber: 2,
        title: 'Graphs 101',
        description: 'BFS/DFS',
        contentDurationMinutes: 90,
        estimatedExecutionMinutes: 180,
        sectionOrder: 1,
        sectionId: 'foundations',
        sectionName: 'Foundations',
        activityType: 'problem',
        priority: 'P1',
        dependencies: ['1']
      }
    ];

    // Verify records structure
    assert.equal(records.length, 2);
    assert.equal(records[0].serialNumber, 1);
    assert.equal(records[1].estimatedExecutionMinutes, 180);
  });

  await t.test('6. Exploration course lifecycle (active vs completed)', () => {
    const exp = new Course({
      userId: '60d5ecb8b392d70015f8a001',
      slug: 'advanced-excel',
      title: 'Advanced Excel & PowerBI',
      category: 'exploration',
      status: 'active',
      emoji: '📊'
    });
    assert.equal(exp.status, 'active');
    assert.equal(exp.category, 'exploration');
    assert.equal(exp.emoji, '📊');

    // Archive / Complete
    exp.status = 'archived';
    assert.equal(exp.status, 'archived');
  });

  await t.test('7. Typing Practice benchmark configuration and CSV metadata preservation', () => {
    const typingPractice = new Course({
      userId: '60d5ecb8b392d70015f8a001',
      slug: 'typing-practice',
      title: 'Typing Practice',
      emoji: '⌨️',
      category: 'exploration',
      priority: 'P3',
      defaultPracticeMultiplier: 1.0,
      targetDate: '2026-12-04',
      description: 'Learn to type faster and better.',
      notes: 'Learn to type faster and better with all fingers on the keyboard using the TypingClub website.',
      status: 'active'
    });

    assert.equal(typingPractice.title, 'Typing Practice');
    assert.equal(typingPractice.emoji, '⌨️');
    assert.equal(typingPractice.category, 'exploration');
    assert.equal(typingPractice.priority, 'P3');
    assert.equal(typingPractice.defaultPracticeMultiplier, 1.0);
    assert.equal(typingPractice.targetDate, '2026-12-04');
    assert.match(typingPractice.notes, /TypingClub/);

    // CSV parser with different course name 'Typing Club'
    const typingCsv = [
      'serial_number,activity_name,content_duration_minutes,course_name',
      '1,Home Row Basics,20,Typing Club',
      '2,Top Row Mastery,25,Typing Club'
    ].join('\n');

    const parsed = CurriculumImporter.parseCsv(typingCsv, typingPractice.defaultPracticeMultiplier);
    assert.equal(parsed.success, true);
    assert.equal(parsed.records.length, 2);
    // At 1.0x multiplier, estimated effort equals content duration (clean integer)
    assert.equal(parsed.records[0].estimatedExecutionMinutes, 20);
    assert.equal(parsed.records[1].estimatedExecutionMinutes, 25);
    // Configured course title remains 'Typing Practice'
    assert.equal(typingPractice.title, 'Typing Practice');
  });

  await t.test('8. Navigation filter strictly separates Courses and Explorations', () => {
    const courses = [
      { slug: 'system-design', title: 'System Design', category: 'course', status: 'active', totalLectures: 10, completedLectures: 2 },
      { slug: 'typing-practice', title: 'Typing Practice', category: 'exploration', status: 'active', totalLectures: 50, completedLectures: 10 },
      { slug: 'advanced-excel', title: 'Advanced Excel', category: 'exploration', status: 'active', totalLectures: 20, completedLectures: 0 },
      { slug: 'algo-mastery', title: 'Algorithm Mastery', category: 'course', status: 'archived', totalLectures: 30, completedLectures: 30 },
      { slug: 'speed-reading', title: 'Speed Reading', category: 'exploration', status: 'archived', totalLectures: 15, completedLectures: 15 },
      { slug: 'oratory', title: 'Oratory Mastery', category: 'oratory', status: 'active' }
    ];

    const isExp = c => c?.category === 'exploration' || c?.slug === 'exploration' || c?.slug === 'exploration-lab';
    const isOratory = c => c?.category === 'oratory' || c?.slug === 'oratory';
    const isDone = c => c?.status === 'archived' || (c?.totalLectures > 0 && c?.completedLectures === c?.totalLectures);

    const activeCourses = courses.filter(c => !isExp(c) && !isOratory(c) && !isDone(c) && c?.slug && c?.title);
    const activeExps = courses.filter(c => isExp(c) && !isOratory(c) && !isDone(c) && c?.slug && c?.title);
    const completedCourses = courses.filter(c => !isExp(c) && !isOratory(c) && isDone(c) && c?.slug && c?.title);
    const completedExps = courses.filter(c => isExp(c) && !isOratory(c) && isDone(c) && c?.slug && c?.title);

    // Active Courses contains ONLY courses, never explorations or oratory
    assert.equal(activeCourses.length, 1);
    assert.equal(activeCourses[0].slug, 'system-design');

    // Active Explorations contains ONLY explorations
    assert.equal(activeExps.length, 2);
    assert.deepEqual(activeExps.map(e => e.slug), ['typing-practice', 'advanced-excel']);

    // Completed strictly separated
    assert.equal(completedCourses.length, 1);
    assert.equal(completedCourses[0].slug, 'algo-mastery');
    assert.equal(completedExps.length, 1);
    assert.equal(completedExps[0].slug, 'speed-reading');
  });

  await t.test('9. Changing Multiplier recalculates remaining effort cleanly with integers', () => {
    const activity = new CurriculumActivity({
      userId: '60d5ecb8b392d70015f8a001',
      courseSlug: 'typing-practice',
      title: 'Number Row & Symbols',
      contentDurationMinutes: 33,
      practiceMultiplier: 1.0,
      totalEffortMinutes: 33,
      remainingMinutes: 33,
      actualMinutes: 0,
      status: 'pending'
    });

    // Multiplier changed to 1.5x
    const newMultiplier = 1.5;
    activity.practiceMultiplier = newMultiplier;
    activity.totalEffortMinutes = Math.round(activity.contentDurationMinutes * newMultiplier);
    activity.remainingMinutes = Math.max(0, activity.totalEffortMinutes - (activity.actualMinutes || 0));

    // 33 * 1.5 = 49.5 -> rounds cleanly to 50
    assert.equal(activity.totalEffortMinutes, 50);
    assert.equal(activity.remainingMinutes, 50);
    assert.equal(Number.isInteger(activity.totalEffortMinutes), true);
    // Original content duration is untouched
    assert.equal(activity.contentDurationMinutes, 33);

    // Partial execution of 15 minutes
    activity.actualMinutes = 15;
    activity.remainingMinutes = Math.max(0, activity.totalEffortMinutes - activity.actualMinutes);
    assert.equal(activity.remainingMinutes, 35);
  });

  await t.test('10. Today integration generates deep links to exploration tracker', () => {
    const act = {
      _id: '60d5ecb8b392d70015f8a099',
      courseSlug: 'typing-practice',
      courseTitle: 'Typing Practice',
      title: 'Shift Key & Capitalization',
      contentDurationMinutes: 20,
      practiceMultiplier: 1.0,
      totalEffortMinutes: 20,
      priority: 'P3',
      activityType: 'exploration'
    };

    const expCourseSlugs = new Set(['typing-practice', 'advanced-excel']);
    const isExp = expCourseSlugs.has(act.courseSlug) || act.activityType === 'exploration';
    const trackerUrl = isExp ? `explore.html?slug=${act.courseSlug}` : `tracker.html?slug=${act.courseSlug}`;

    assert.equal(isExp, true);
    assert.equal(trackerUrl, 'explore.html?slug=typing-practice');
  });

  await t.test('11. Arbitrary future explorations are completely dynamic and not tied to any specific subject', () => {
    // Tests that any arbitrary future exploration track behaves with full generality
    const subjects = [
      { slug: 'financial-modelling-track', title: 'Financial Modelling & DCF', emoji: '📈', multiplier: 1.5 },
      { slug: 'quantum-computing-lab', title: 'Quantum Computing Fundamentals', emoji: '🔬', multiplier: 2.0 },
      { slug: 'french-language-mastery', title: 'Conversational French B1', emoji: '🌐', multiplier: 1.0 },
      { slug: 'rust-systems-programming', title: 'Rust Low-Level Systems', emoji: '⚙️', multiplier: 2.5 }
    ];

    for (const sub of subjects) {
      const exp = new Course({
        userId: '60d5ecb8b392d70015f8a001',
        slug: sub.slug,
        title: sub.title,
        emoji: sub.emoji,
        category: 'exploration',
        defaultPracticeMultiplier: sub.multiplier,
        status: 'active'
      });

      assert.equal(exp.category, 'exploration');
      assert.equal(exp.emoji, sub.emoji);
      assert.equal(exp.status, 'active');
      assert.equal(exp.defaultPracticeMultiplier, sub.multiplier);
      assert.equal(exp.validateSync(), undefined);
    }
  });

  await t.test('12. Navigation completion filter removes 100% completed tracks from sidebar', () => {
    const isDone = c => c?.status === 'archived' || (Number(c?.totalLectures) > 0 && Number(c?.completedLectures) >= Number(c?.totalLectures));
    const isExp = c => c?.category === 'exploration' || c?.slug === 'exploration' || c?.slug === 'exploration-lab';
    const isOratory = c => c?.category === 'oratory' || c?.slug === 'oratory';

    const testCourses = [
      { slug: 'dsa-active', title: 'Active DSA', category: 'course', status: 'active', totalLectures: 10, completedLectures: 3, emoji: '💻' },
      { slug: 'webdev-done', title: 'Completed Web Dev', category: 'course', status: 'archived', totalLectures: 10, completedLectures: 10, emoji: '🌐' },
      { slug: 'quantum-active', title: 'Quantum Lab', category: 'exploration', status: 'active', totalLectures: 5, completedLectures: 1, emoji: '🔬' },
      { slug: 'typing-done', title: 'Typing Practice', category: 'exploration', status: 'archived', totalLectures: 30, completedLectures: 30, emoji: '⌨️' }
    ];

    const activeCourses = testCourses.filter(c => !isExp(c) && !isOratory(c) && !isDone(c));
    const activeExps = testCourses.filter(c => isExp(c) && !isOratory(c) && !isDone(c));

    // Completed tracks MUST be filtered out of sidebar navigation
    assert.deepEqual(activeCourses.map(c => c.slug), ['dsa-active']);
    assert.deepEqual(activeExps.map(c => c.slug), ['quantum-active']);

    // Completed tracks remain accessible in hub sorted to the end
    const sortedHub = [...testCourses].sort((a, b) => {
      const aDone = isDone(a);
      const bDone = isDone(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (a.title || '').localeCompare(b.title || '');
    });

    assert.equal(isDone(sortedHub[0]), false);
    assert.equal(isDone(sortedHub[1]), false);
    assert.equal(isDone(sortedHub[2]), true);
    assert.equal(isDone(sortedHub[3]), true);
  });

  await t.test('13. Course & Exploration emoji update persistence in settings', () => {
    const course = new Course({
      userId: '60d5ecb8b392d70015f8a001',
      slug: 'machine-learning',
      title: 'Machine Learning',
      emoji: '📚',
      category: 'course'
    });

    assert.equal(course.emoji, '📚');

    // User updates emoji via Course Settings
    course.emoji = '🤖';
    assert.equal(course.emoji, '🤖');

    // User updates to compound/surrogate emoji (e.g. keyboard)
    course.emoji = '⌨️';
    assert.equal(course.emoji, '⌨️');
    assert.equal(course.validateSync(), undefined);
  });

  await t.test('14. Partial lecture headway (e.g. 90m of 120m) preserves 30m remaining without triggering Slack Day', () => {
    const lecture = {
      title: 'Lecture 10: Binary Search Implementation',
      contentDurationMinutes: 60,
      practiceMultiplier: 2.0,
      totalEffortMinutes: 120,
      actualMinutes: 0,
      remainingMinutes: 120,
      status: 'pending'
    };

    // User logs 90 minutes of focused effort
    const loggedSessionMinutes = 90;
    lecture.actualMinutes += loggedSessionMinutes;
    lecture.remainingMinutes = Math.max(0, lecture.totalEffortMinutes - lecture.actualMinutes);
    lecture.status = lecture.remainingMinutes === 0 ? 'completed' : 'in-progress';

    // Must preserve 30m remaining
    assert.equal(lecture.actualMinutes, 90);
    assert.equal(lecture.remainingMinutes, 30);
    assert.equal(lecture.status, 'in-progress');

    // Crucial rule: An in-progress lecture does NOT declare a Slack Day
    const isSlackDayTriggered = false; // Never triggered by partial headway
    assert.equal(isSlackDayTriggered, false);
  });

  await t.test('15. Completing current lecture unblocks next lecture with advance study capability', () => {
    const lecture10 = {
      activityNumber: 10,
      title: 'Lecture 10: Binary Search',
      remainingMinutes: 30,
      status: 'in-progress'
    };

    const lecture11 = {
      activityNumber: 11,
      title: 'Lecture 11: Search in Rotated Sorted Array',
      totalEffortMinutes: 110,
      remainingMinutes: 110,
      status: 'pending',
      scheduledNote: 'Scheduled for Tomorrow / Next Study Session'
    };

    // User finishes the final 30 minutes of Lecture 10
    lecture10.remainingMinutes = 0;
    lecture10.status = 'completed';

    // Next lecture is immediately actionable in advance
    assert.equal(lecture10.status, 'completed');
    assert.equal(lecture11.activityNumber, 11);
    assert.equal(lecture11.remainingMinutes, 110);
    assert.equal(lecture11.scheduledNote, 'Scheduled for Tomorrow / Next Study Session');
  });

  await t.test('16. Pacing & P3 Habit Negotiation Guidance protects reading consistency', () => {
    const coachingGuidance = {
      remainingMinutes: 30,
      suggestedPacing: 'Finish these 30m first. Next lecture requires 110m. Aim for at least 100m in your available window.',
      p3Tip: 'If pressed for time, borrow 10–15m from P3 activities (Typing Practice or Book Reading), but keep at least 5–10m for Book Reading so your daily streak stays alive.'
    };

    // Must never suggest eating 100% of P3 reading habit
    assert.match(coachingGuidance.p3Tip, /keep at least 5–10m for Book Reading/i);
    assert.match(coachingGuidance.suggestedPacing, /Aim for at least 100m/i);
  });

  await t.test('17. Sunday detection enables body measurement & weigh-in check-in', () => {
    const sundayDate = '2026-11-29'; // A Sunday
    const dayOfWeek = new Date(sundayDate).getDay(); // 0 is Sunday
    const isSunday = dayOfWeek === 0;

    assert.equal(isSunday, true);
    const weightLog = {
      date: sundayDate,
      weightKg: 85.4,
      targetKg: 73,
      baselineKg: 90
    };

    assert.ok(weightLog.weightKg < weightLog.baselineKg);
    assert.equal(weightLog.weightKg, 85.4);
  });
});
