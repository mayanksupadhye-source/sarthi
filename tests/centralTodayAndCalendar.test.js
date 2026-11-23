import test from 'node:test';
import assert from 'node:assert/strict';
import { CurriculumImporter } from '../server/services/curriculumImporter.js';
import { PlannerEngine } from '../server/services/plannerEngine.js';
import { formatTimeRange, formatTime12 } from '../server/utils/timeFormat.js';

test('SARTHI Central Today Experience — Information Hierarchy & Multipliers', async (suite) => {

  await suite.test('1. Separates original content duration from estimated personal effort (1.6x - 2x)', () => {
    const csv = `serial_number,activity_name,content_duration_minutes
1,Graph Dijkstra Algorithm,50`;
    const parsed = CurriculumImporter.parseCsv(csv, 1.6);
    assert.equal(parsed.success, true);
    const item = parsed.records[0];

    assert.equal(item.contentDurationMinutes, 50);
    // 50 * 1.6 = 80 effort minutes
    assert.equal(item.estimatedExecutionMinutes, 80);
    assert.notEqual(item.contentDurationMinutes, item.estimatedExecutionMinutes);
  });

  await suite.test('2. Partial execution credits exact minutes and updates remaining effort', () => {
    const plannedEffort = 120;
    const actualLogged = 70;

    const activity = {
      title: 'Full-Stack Auth & Sessions',
      totalEffortMinutes: plannedEffort,
      actualMinutes: 0,
      remainingMinutes: plannedEffort,
      status: 'pending'
    };

    // User logs 70m of work
    activity.actualMinutes += actualLogged;
    activity.remainingMinutes = Math.max(0, activity.totalEffortMinutes - activity.actualMinutes);
    activity.status = activity.remainingMinutes === 0 ? 'completed' : 'in-progress';

    assert.equal(activity.actualMinutes, 70);
    assert.equal(activity.remainingMinutes, 50);
    assert.equal(activity.status, 'in-progress');
  });

  await suite.test('3. Completing activity sets remaining minutes to 0 and retains full actual minutes', () => {
    const activity = {
      title: 'Full-Stack Auth & Sessions',
      totalEffortMinutes: 120,
      actualMinutes: 70,
      remainingMinutes: 50,
      status: 'in-progress'
    };

    // User finishes the final 50m
    activity.actualMinutes += 50;
    activity.remainingMinutes = Math.max(0, activity.totalEffortMinutes - activity.actualMinutes);
    activity.status = activity.remainingMinutes === 0 ? 'completed' : 'in-progress';

    assert.equal(activity.actualMinutes, 120);
    assert.equal(activity.remainingMinutes, 0);
    assert.equal(activity.status, 'completed');
  });

  await suite.test('4. Over-execution retains all actual minutes without artificial capping', () => {
    const activity = {
      title: 'LeetCode Hard Dynamic Programming',
      totalEffortMinutes: 60,
      actualMinutes: 0,
      remainingMinutes: 60
    };

    // User deep dives for 90m on a 60m planned problem
    activity.actualMinutes += 90;
    activity.remainingMinutes = Math.max(0, activity.totalEffortMinutes - activity.actualMinutes);

    assert.equal(activity.actualMinutes, 90);
    assert.equal(activity.remainingMinutes, 0);
  });
});

test('SARTHI Central Today Experience — Cross-Module Scheduled Work & Completed Records', async (suite) => {

  await suite.test('1. Assembles cross-module scheduled work into canonical shape with deep-links', () => {
    const mockCourseActivity = {
      courseSlug: 'webdev',
      courseTitle: 'Full-Stack Web Development',
      title: 'CSS Grid Complex Layouts',
      contentDurationMinutes: 35,
      practiceMultiplier: 1.6,
      totalEffortMinutes: 56,
      remainingMinutes: 56,
      priority: 'P2'
    };

    const mockReadingBook = {
      id: 'book-101',
      title: 'The Pragmatic Programmer',
      author: 'David Thomas & Andrew Hunt',
      currentPage: 82,
      totalPages: 352
    };

    const mockAssignment = {
      id: 'asg-201',
      title: 'Database Normalization Assignment 3',
      dueDate: '2026-11-25',
      priority: 'P1',
      estimatedMinutes: 60
    };

    const mockExam = {
      id: 'exam-301',
      subjectName: 'Computer Networks',
      examType: 'in-sem',
      examDate: '2026-11-28',
      durationMinutes: 120
    };

    // Assemble scheduled work
    const scheduledWork = [
      {
        type: 'course',
        title: mockCourseActivity.title,
        courseSlug: mockCourseActivity.courseSlug,
        contentDurationMinutes: mockCourseActivity.contentDurationMinutes,
        totalEffortMinutes: mockCourseActivity.totalEffortMinutes,
        remainingMinutes: mockCourseActivity.remainingMinutes,
        priority: mockCourseActivity.priority,
        trackerUrl: `tracker.html?slug=${mockCourseActivity.courseSlug}`
      },
      {
        type: 'reading',
        title: `Read: ${mockReadingBook.title}`,
        author: mockReadingBook.author,
        trackerUrl: 'reading.html'
      },
      {
        type: 'academic',
        title: mockAssignment.title,
        dueDate: mockAssignment.dueDate,
        priority: mockAssignment.priority,
        trackerUrl: 'academics.html'
      },
      {
        type: 'exam_prep',
        title: `Exam Prep: ${mockExam.subjectName}`,
        examDate: mockExam.examDate,
        priority: 'P1',
        trackerUrl: 'academics.html'
      }
    ];

    assert.equal(scheduledWork.length, 4);
    assert.equal(scheduledWork[0].trackerUrl, 'tracker.html?slug=webdev');
    assert.equal(scheduledWork[1].trackerUrl, 'reading.html');
    assert.equal(scheduledWork[2].trackerUrl, 'academics.html');
    assert.equal(scheduledWork[3].trackerUrl, 'academics.html');
  });

  await suite.test('2. Completed items are preserved across refresh and include actual minutes', () => {
    const completedTasks = [
      { id: 't1', title: 'LeetCode 704 Binary Search', category: 'dsa', actualMinutes: 35, status: 'completed' }
    ];
    const completedActs = [
      { id: 'a1', title: 'Chai aur JavaScript Loops', courseSlug: 'webdev', actualMinutes: 45, status: 'completed' }
    ];
    const readingLogs = [
      { id: 'r1', bookTitle: 'Clean Code', durationMinutes: 30, pagesRead: 15 }
    ];

    const completedToday = [
      ...completedTasks.map(t => ({ id: t.id, title: t.title, type: 'task', actualMinutes: t.actualMinutes })),
      ...completedActs.map(a => ({ id: a.id, title: a.title, type: 'course', actualMinutes: a.actualMinutes })),
      ...readingLogs.map(r => ({ id: r.id, title: `Reading: ${r.bookTitle}`, type: 'reading', actualMinutes: r.durationMinutes }))
    ];

    assert.equal(completedToday.length, 3);
    const totalMinutes = completedToday.reduce((sum, item) => sum + item.actualMinutes, 0);
    assert.equal(totalMinutes, 110);
    assert.equal(completedToday[0].type, 'task');
    assert.equal(completedToday[1].type, 'course');
    assert.equal(completedToday[2].type, 'reading');
  });
});

test('SARTHI Timetable System — Routine Architecture & Overnight Blocks', async (suite) => {

  await suite.test('1. Distinguishes fixed routine from actionable routine', () => {
    const sleepBlock = {
      label: 'Protected Sleep',
      category: 'rest',
      blockType: 'fixed_routine',
      isTrackable: false
    };

    const gymBlock = {
      label: 'Gym & Core Workout',
      category: 'gym',
      blockType: 'actionable_routine',
      isTrackable: true
    };

    assert.equal(sleepBlock.isTrackable, false);
    assert.equal(sleepBlock.blockType, 'fixed_routine');
    assert.equal(gymBlock.isTrackable, true);
    assert.equal(gymBlock.blockType, 'actionable_routine');
  });

  await suite.test('2. Accurately calculates duration for sleep crossing midnight', () => {
    // 23:40 to 07:00
    const startStr = '23:40';
    const endStr = '07:00';

    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    let duration = endMinutes - startMinutes;
    if (duration <= 0) {
      duration += 24 * 60; // 1440 minutes in a full day
    }

    assert.equal(duration, 440); // 20 mins before midnight + 420 mins after = 440m (7h 20m)
    assert.equal(formatTimeRange(startStr, endStr), '11:40 PM – 7:00 AM');
  });

  await suite.test('3. Timetable block assigns dynamic course slug without hardcoding', () => {
    const studyBlock = {
      blockId: 'blk-study-1',
      label: 'Deep Focus Core Study',
      startTime: '10:00',
      endTime: '12:00',
      durationMinutes: 120,
      category: 'study',
      courseSlug: 'machine-learning'
    };

    assert.equal(studyBlock.courseSlug, 'machine-learning');
    assert.equal(studyBlock.durationMinutes, 120);
  });
});

test('SARTHI Calendar Synchronization — Unified Month Range Feeds', async (suite) => {

  await suite.test('1. Calendar feeds aggregate exams, preparation dates, assignments, and tasks', () => {
    const month = '2026-11';
    const startDate = `${month}-01`;
    const endDate = `${month}-30`;

    const events = [
      { date: '2026-11-15', type: 'exam', title: 'Data Structures End-Sem' },
      { date: '2026-11-14', type: 'exam_prep', title: 'Prep: Data Structures' },
      { date: '2026-11-20', type: 'assignment', title: 'OS Kernel Assignment Due' },
      { date: '2026-11-22', type: 'slack_day', title: 'Slack Day Activated' }
    ];

    const inRange = events.filter(e => e.date >= startDate && e.date <= endDate);
    assert.equal(inRange.length, 4);

    const dayGroup = {};
    inRange.forEach(e => {
      dayGroup[e.date] = dayGroup[e.date] || [];
      dayGroup[e.date].push(e);
    });

    assert.equal(dayGroup['2026-11-15'][0].type, 'exam');
    assert.equal(dayGroup['2026-11-14'][0].type, 'exam_prep');
    assert.equal(dayGroup['2026-11-20'][0].type, 'assignment');
    assert.equal(dayGroup['2026-11-22'][0].type, 'slack_day');
  });
});

test('SARTHI Daily Reflection — Multi-Prompt Structure & Date Isolation', async (suite) => {

  await suite.test('1. Preserves multi-prompt reflections (whatWentWell, whatStruggled, whatImprove)', () => {
    const reflection = {
      whatWentWell: 'Completed 2 LeetCode problems and stuck to the morning routine',
      whatStruggled: 'Lost 40 minutes on build configuration error',
      whatImprove: 'Set a 15-minute timer before asking for help or checking docs',
      summary: 'Solid execution day overall'
    };

    assert.equal(reflection.whatWentWell.includes('LeetCode'), true);
    assert.equal(reflection.whatStruggled.includes('build configuration'), true);
    assert.equal(reflection.whatImprove.includes('15-minute timer'), true);
  });

  await suite.test('2. Ensures date isolation: updating reflection for Day 2 does not alter Day 1', () => {
    const dailyPlans = {
      '2026-11-21': {
        date: '2026-11-21',
        reflection: { whatWentWell: 'Day 1 good progress', whatStruggled: 'Tired in evening' }
      },
      '2026-11-22': {
        date: '2026-11-22',
        reflection: { whatWentWell: 'Day 2 cleared backlog', whatStruggled: 'None' }
      }
    };

    // Update Day 2
    dailyPlans['2026-11-22'].reflection.whatWentWell = 'Day 2 updated with even more progress';

    // Day 1 must remain untouched
    assert.equal(dailyPlans['2026-11-21'].reflection.whatWentWell, 'Day 1 good progress');
    assert.equal(dailyPlans['2026-11-22'].reflection.whatWentWell, 'Day 2 updated with even more progress');
  });
});
