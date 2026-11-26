import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlannerEngine } from '../server/services/plannerEngine.js';

describe('SARTHI Dynamic Allocation Engine — Pure Allocator Fixtures', () => {
  // Common fixtures
  const sampleCourses = [
    {
      slug: 'dsa',
      title: 'Data Structures & Algorithms',
      category: 'course',
      priority: 'P1',
      defaultPracticeMultiplier: 2.0,
      lectures: [
        { lectureNumber: 1, title: 'Arrays & Vectors', videoDurationMinutes: 30, totalEffortMinutes: 60 },
        { lectureNumber: 2, title: 'Binary Search', videoDurationMinutes: 45, totalEffortMinutes: 90 },
        { lectureNumber: 3, title: 'Recursion Basics', videoDurationMinutes: 30, totalEffortMinutes: 60 },
      ],
    },
    {
      slug: 'web-dev',
      title: 'Full Stack Web Development',
      category: 'course',
      priority: 'P1',
      defaultPracticeMultiplier: 2.0,
      lectures: [
        { lectureNumber: 1, title: 'HTML & Semantic Web', videoDurationMinutes: 30, totalEffortMinutes: 60 },
        { lectureNumber: 2, title: 'CSS Flexbox & Grid', videoDurationMinutes: 30, totalEffortMinutes: 60 },
        { lectureNumber: 3, title: 'JavaScript Engine', videoDurationMinutes: 45, totalEffortMinutes: 90 },
      ],
    },
    {
      slug: 'typing-practice',
      title: 'Touch Typing Mastery',
      category: 'exploration',
      priority: 'P3',
      defaultPracticeMultiplier: 1.0,
      lectures: [
        { lectureNumber: 1, title: 'Home Row Drills', videoDurationMinutes: 30, totalEffortMinutes: 30 },
        { lectureNumber: 2, title: 'Top Row Drills', videoDurationMinutes: 30, totalEffortMinutes: 30 },
      ],
    },
  ];

  const standardTimetables = {
    weekday: {
      dayType: 'weekday',
      blocks: [
        { label: 'DSA Core Study', startTime: '06:00', endTime: '07:30', durationMinutes: 90, category: 'study', courseSlug: 'dsa' },
        { label: 'Web Dev Deep Work', startTime: '18:30', endTime: '20:00', durationMinutes: 90, category: 'study', courseSlug: 'web-dev' },
      ],
    },
    saturday: {
      dayType: 'saturday',
      blocks: [
        { label: 'DSA Intensive', startTime: '06:00', endTime: '08:00', durationMinutes: 120, category: 'study', courseSlug: 'dsa' },
        { label: 'Web Dev Projects', startTime: '17:00', endTime: '19:00', durationMinutes: 120, category: 'study', courseSlug: 'web-dev' },
        { label: 'Typing Lab', startTime: '20:00', endTime: '20:30', durationMinutes: 30, category: 'exploration', courseSlug: 'typing-practice' },
      ],
    },
    sunday: {
      dayType: 'sunday',
      blocks: [
        { label: 'Web Dev Fullstack', startTime: '09:00', endTime: '11:00', durationMinutes: 120, category: 'study', courseSlug: 'web-dev' },
        { label: 'Oratory Practice', startTime: '15:00', endTime: '16:00', durationMinutes: 60, category: 'oratory', courseSlug: 'oratory' },
      ],
    },
  };

  it('1. Sunday without DSA: DSA is scheduled on weekday and Saturday, but completely omitted on Sunday', () => {
    // 2026-11-28 is Saturday, 2026-11-29 is Sunday
    const result = PlannerEngine.allocate({
      courses: sampleCourses,
      progressLogs: [],
      timetablePerDate: standardTimetables,
      today: '2026-11-28',
      horizonDays: 2,
    });

    const satPlan = result.dayPlans.find((p) => p.date === '2026-11-28');
    const sunPlan = result.dayPlans.find((p) => p.date === '2026-11-29');

    assert.ok(satPlan, 'Saturday plan must exist');
    assert.ok(sunPlan, 'Sunday plan must exist');

    // Saturday has DSA, Web Dev, and Typing
    const satSlugs = satPlan.coursePlans.map((c) => c.courseSlug);
    assert.ok(satSlugs.includes('dsa'), 'Saturday must have DSA');
    assert.ok(satSlugs.includes('web-dev'), 'Saturday must have Web Dev');
    assert.ok(satSlugs.includes('typing-practice'), 'Saturday must have Typing');

    // Sunday has Web Dev, but DSA and Typing are strictly omitted because Sunday timetable has no block for them
    const sunSlugs = sunPlan.coursePlans.map((c) => c.courseSlug);
    assert.ok(sunSlugs.includes('web-dev'), 'Sunday must have Web Dev');
    assert.ok(!sunSlugs.includes('dsa'), 'Sunday must NOT have DSA because Sunday timetable has no block for it');
    assert.ok(!sunSlugs.includes('typing-practice'), 'Sunday must NOT have Typing because Sunday timetable has no typing block');
  });

  it('2. Carryover Order: Unfinished minutes carry over to next working session and come first', () => {
    // User had a target of 60m on 2026-11-24, but logged only 30m
    const progressLogs = [
      { courseSlug: 'dsa', date: '2026-11-24', minutesSpent: 30, type: 'regular' },
    ];

    const result = PlannerEngine.allocate({
      courses: sampleCourses,
      progressLogs,
      timetablePerDate: standardTimetables,
      today: '2026-11-25',
      horizonDays: 3,
    });

    const todayPlan = result.dayPlans.find((p) => p.date === '2026-11-25');
    const dsaPlan = todayPlan.coursePlans.find((c) => c.courseSlug === 'dsa');

    assert.ok(dsaPlan, 'DSA plan must exist for today');
    // Position must reflect exactly 30m of effort completed = 15m video completed
    assert.equal(dsaPlan.startPosition, 'Lecture 1 (15:00)', 'Start position must resume from 15:00 mark');
  });

  it('3. Ahead-of-Plan Pull-Forward: Logging extra work pulls the schedule earlier', () => {
    // User completed 120m on day 1 (twice the 60m effort of Lecture 1)
    const progressLogs = [
      { courseSlug: 'dsa', date: '2026-11-24', minutesSpent: 120, type: 'regular' },
    ];

    const result = PlannerEngine.allocate({
      courses: sampleCourses,
      progressLogs,
      timetablePerDate: standardTimetables,
      today: '2026-11-25',
      horizonDays: 2,
    });

    const dsaPlan = result.dayPlans[0].coursePlans.find((c) => c.courseSlug === 'dsa');
    assert.ok(dsaPlan, 'DSA plan must exist');
    // 120m effort at multiplier 2.0 = 60m video. Lecture 1 was 30m, so Lecture 1 is finished, and 30m of Lecture 2 is finished!
    assert.equal(dsaPlan.startLectureNumber, 2);
    assert.equal(dsaPlan.startPosition, 'Lecture 2 (30:00)', 'Ahead logging must advance start position into Lecture 2');
  });

  it('4. Exam Pause and Resume: Courses pause during exam profile with zero backlog dump, then resume cleanly', () => {
    const examTimetable = {
      dayType: 'exam',
      blocks: [
        { label: 'Morning Revision: Mathematics', startTime: '06:00', endTime: '09:00', durationMinutes: 180, category: 'study' },
        { label: 'Subject Exam Session', startTime: '10:00', endTime: '13:00', durationMinutes: 180, category: 'study' },
      ],
    };

    const timetableResolver = (dateStr) => {
      // 2026-12-01 to 2026-12-03 is exam profile
      if (dateStr >= '2026-12-01' && dateStr <= '2026-12-03') {
        return examTimetable;
      }
      return standardTimetables.weekday;
    };

    const result = PlannerEngine.allocate({
      courses: sampleCourses,
      progressLogs: [],
      timetablePerDate: timetableResolver,
      specialDates: { examDates: new Set(['2026-12-01', '2026-12-02', '2026-12-03']) },
      today: '2026-11-30',
      horizonDays: 6,
    });

    const examDayPlan = result.dayPlans.find((p) => p.date === '2026-12-02');
    assert.equal(examDayPlan.isExamDay, true);
    assert.equal(examDayPlan.coursePlans.length, 0, 'No non-exam courses should run during exam day');

    // Post-exam day (2026-12-04) resumes from exact position without backlog penalty
    const resumePlan = result.dayPlans.find((p) => p.date === '2026-12-04');
    assert.ok(resumePlan);
    const dsaResume = resumePlan.coursePlans.find((c) => c.courseSlug === 'dsa');
    assert.ok(dsaResume, 'DSA must resume after exam profile');
    assert.equal(dsaResume.carryoverMin, 0, 'No false carryover accumulated during planned exam pause');
  });

  it('5. Infeasible Multiplier Detection: Detects shortfall and returns computed suggestions', () => {
    const heavyCourse = [
      {
        slug: 'massive-course',
        title: 'Massive Computer Science Curriculum',
        category: 'course',
        multiplier: 2.0,
        startDate: '2026-12-01',
        targetDate: '2026-12-05', // Only 5 days
        totalHours: 100, // 100 hours = 6,000 video mins = 12,000 effort mins!
      },
    ];

    const result = PlannerEngine.allocate({
      courses: heavyCourse,
      progressLogs: [],
      timetablePerDate: standardTimetables,
      today: '2026-12-01',
      horizonDays: 5,
    });

    const feas = result.feasibility['massive-course'];
    assert.ok(feas, 'Feasibility report must exist');
    assert.equal(feas.isFeasible, false, 'Massive course in 5 days must be marked infeasible');
    assert.ok(feas.shortfallMinutes > 0, 'Shortfall must be greater than 0');
    assert.ok(feas.suggestedDailyMinutes > 0, 'Must suggest required daily minutes');
  });

  it('6. Slack Proposal: Proposes slack only after repeated consecutive misses, never on single miss', () => {
    // Single course fixture to isolate miss detection
    const singleCourse = [sampleCourses[0]]; // DSA only

    // Test Single Miss: Completed 23rd, 24th; only 25th missed
    const singleMissLogs = [
      { courseSlug: 'dsa', date: '2026-11-23', minutesSpent: 90, type: 'regular' },
      { courseSlug: 'dsa', date: '2026-11-24', minutesSpent: 90, type: 'regular' },
      { courseSlug: 'dsa', date: '2026-11-25', minutesSpent: 0, type: 'regular' },
    ];

    const resultSingle = PlannerEngine.allocate({
      courses: singleCourse,
      progressLogs: singleMissLogs,
      timetablePerDate: standardTimetables,
      today: '2026-11-26',
      horizonDays: 2,
    });

    assert.equal(resultSingle.slackProposal.proposed, false, 'Single miss must NEVER propose a slack day');

    // Test 3 Consecutive Misses (0 minutes logged across 23rd, 24th, 25th on scheduled days)
    const threeMissLogs = [
      { courseSlug: 'dsa', date: '2026-11-23', minutesSpent: 0, type: 'regular' },
      { courseSlug: 'dsa', date: '2026-11-24', minutesSpent: 0, type: 'regular' },
      { courseSlug: 'dsa', date: '2026-11-25', minutesSpent: 0, type: 'regular' },
    ];

    const resultThree = PlannerEngine.allocate({
      courses: singleCourse,
      progressLogs: threeMissLogs,
      timetablePerDate: standardTimetables,
      today: '2026-11-26',
      horizonDays: 2,
    });

    assert.equal(resultThree.slackProposal.proposed, true, 'Three consecutive misses must trigger a slack proposal');
    assert.ok(resultThree.slackProposal.reason.includes('consecutive missed targets'), 'Reason must explain the misses mathematically');
  });

  it('7. End-to-End Integration Flow: import, distribute, log, and verify DayPlan matching exact numbers', () => {
    // 1. Simulate imported CSV course with 2x multiplier
    const importedCourse = {
      slug: 'fullstack-web',
      title: 'Fullstack Web Development',
      category: 'course',
      defaultPracticeMultiplier: 2.0,
      lectures: [
        { lectureNumber: 1, title: 'Node.js Internals', videoDurationMinutes: 30, totalEffortMinutes: 60 },
        { lectureNumber: 2, title: 'Express & Middleware', videoDurationMinutes: 45, totalEffortMinutes: 90 },
      ],
    };

    // 2. Distribute on weekday timetable with 60m block
    const initialRun = PlannerEngine.allocate({
      courses: [importedCourse],
      progressLogs: [],
      timetablePerDate: {
        weekday: {
          dayType: 'weekday',
          blocks: [{ label: 'Web Study', startTime: '18:00', endTime: '19:00', durationMinutes: 60, courseSlug: 'fullstack-web' }],
        },
      },
      today: '2026-11-25',
      horizonDays: 2,
    });

    const day1Plan = initialRun.dayPlans[0].coursePlans[0];
    assert.equal(day1Plan.effortMinTarget, 60, 'Day 1 effort target must match block duration 60m');
    assert.equal(day1Plan.lectureMinTarget, 30, 'Day 1 lecture target must be 30m video (at 2x multiplier)');
    assert.equal(day1Plan.startPosition, 'Lecture 1 (00:00)');
    assert.equal(day1Plan.endPosition, 'Lecture 2 (00:00)');

    // 3. Log 30 minutes (partial completion)
    const logsAfterDay1 = [
      { courseSlug: 'fullstack-web', date: '2026-11-25', minutesSpent: 30, type: 'regular' },
    ];

    // 4. Replan on Day 2
    const day2Run = PlannerEngine.allocate({
      courses: [importedCourse],
      progressLogs: logsAfterDay1,
      timetablePerDate: {
        weekday: {
          dayType: 'weekday',
          blocks: [{ label: 'Web Study', startTime: '18:00', endTime: '19:00', durationMinutes: 60, courseSlug: 'fullstack-web' }],
        },
      },
      today: '2026-11-26',
      horizonDays: 2,
    });

    const day2Plan = day2Run.dayPlans[0].coursePlans[0];
    assert.equal(day2Plan.startPosition, 'Lecture 1 (15:00)', 'Day 2 must resume from 15:00 mark');
    assert.equal(day2Plan.effortMinTarget, 60, 'Day 2 must allocate 60m capacity');
    assert.equal(day2Plan.lectureMinTarget, 30, 'Day 2 must target 30m video');
    assert.equal(day2Plan.endPosition, 'Lecture 2 (15:00)');
  });
});
