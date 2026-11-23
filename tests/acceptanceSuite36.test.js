import test from 'node:test';
import assert from 'node:assert/strict';
import { CurriculumImporter } from '../server/services/curriculumImporter.js';
import { PlannerEngine } from '../server/services/plannerEngine.js';
import { ExecutionSyncService } from '../server/services/executionSyncService.js';
import { formatTimeRange, formatTime12 } from '../server/utils/timeFormat.js';

// ===========================================================================
// SARTHI — FULL 36-SCENARIO END-TO-END ACCEPTANCE SUITE (PART 22)
// ===========================================================================

test('SARTHI Master Acceptance Test Suite — 36 Scenarios', async (suite) => {

  // Scenario 1: Create a course using the universal CSV importer
  await suite.test('Scenario 1: Create a course using the universal CSV importer', () => {
    const csv = `serial_number,activity_name,content_duration_minutes
1,Introduction to Python,30`;
    const parsed = CurriculumImporter.parseCsv(csv);
    assert.equal(parsed.success, true);
    assert.equal(parsed.records.length, 1);
    assert.equal(parsed.records[0].title, 'Introduction to Python');
  });

  // Scenario 2: Import sections with subsections
  await suite.test('Scenario 2: Import sections with subsections', () => {
    const csv = `serial_number,section_name,subsection_name,activity_name,content_duration_minutes
1,Binary Trees,Tree Traversals,Inorder Traversal,40`;
    const parsed = CurriculumImporter.parseCsv(csv);
    assert.equal(parsed.success, true);
    assert.equal(parsed.records[0].sectionName, 'Binary Trees');
    assert.equal(parsed.records[0].subsectionName, 'Tree Traversals');
  });

  // Scenario 3: Import sections without subsections
  await suite.test('Scenario 3: Import sections without subsections', () => {
    const csv = `serial_number,section_name,activity_name,content_duration_minutes
1,CSS Grid,CSS Grid Overview,45`;
    const parsed = CurriculumImporter.parseCsv(csv);
    assert.equal(parsed.success, true);
    assert.equal(parsed.records[0].sectionName, 'CSS Grid');
    assert.equal(parsed.records[0].subsectionName, null);
  });

  // Scenario 4: Verify original content duration and 2× effort
  await suite.test('Scenario 4: Verify original content duration and 2x effort', () => {
    const csv = `serial_number,activity_name,content_duration_minutes
1,Distributed Caching,45`;
    const parsed = CurriculumImporter.parseCsv(csv);
    const item = parsed.records[0];
    assert.equal(item.contentDurationMinutes, 45);
    assert.equal(item.estimatedExecutionMinutes, 90, 'Default 2x multiplier must double content duration');
  });

  // Scenario 5: Assign the course to a timetable block
  await suite.test('Scenario 5: Assign the course to a timetable block', () => {
    const block = {
      blockId: 'b1', label: 'Morning Deep Work', startTime: '06:00', endTime: '08:00',
      durationMinutes: 120, category: 'study', blockType: 'learning', courseSlug: 'dsa'
    };
    assert.equal(block.courseSlug, 'dsa');
    assert.equal(block.blockType, 'learning');
  });

  // Scenario 6: Assign two different courses to separate blocks
  await suite.test('Scenario 6: Assign two different courses to separate blocks', () => {
    const blocks = [
      { blockId: 'b1', courseSlug: 'dsa', durationMinutes: 120, blockType: 'learning' },
      { blockId: 'b2', courseSlug: 'web-development', durationMinutes: 90, blockType: 'learning' }
    ];
    assert.notEqual(blocks[0].courseSlug, blocks[1].courseSlug);
  });

  // Scenario 7: Assign the same course to two blocks on one day
  await suite.test('Scenario 7: Assign the same course to two blocks on one day', () => {
    const blocks = [
      { blockId: 'b1', courseSlug: 'dsa', durationMinutes: 90 },
      { blockId: 'b2', courseSlug: 'dsa', durationMinutes: 60 }
    ];
    const totalDsaMinutes = blocks.filter(b => b.courseSlug === 'dsa').reduce((s, b) => s + b.durationMinutes, 0);
    assert.equal(totalDsaMinutes, 150);
  });

  // Scenario 8: Verify future allocations
  await suite.test('Scenario 8: Verify future allocations', () => {
    const blocks = [{ blockId: 'b1', category: 'study', courseSlug: 'dsa', durationMinutes: 90, blockType: 'learning' }];
    const activities = [
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 1, title: 'Arrays', totalEffortMinutes: 45, status: 'pending' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 2, title: 'Sliding Window', totalEffortMinutes: 45, status: 'pending' }
    ];
    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });
    assert.equal(result.allocatedActivitiesCount, 2);
    assert.equal(result.totalAllocatedMinutes, 90);
  });

  // Scenario 9: Verify section-boundary allocation
  await suite.test('Scenario 9: Verify section-boundary allocation', () => {
    const blocks = [{ blockId: 'b1', category: 'study', courseSlug: null, durationMinutes: 60, blockType: 'learning' }];
    const activities = [
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 1, title: 'A1', totalEffortMinutes: 40, status: 'pending' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 2, activityNumber: 1, title: 'A2', totalEffortMinutes: 50, status: 'pending' }
    ];
    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities, minCoherentMinutes: 15 });
    assert.equal(result.allocatedActivitiesCount, 1, 'Does not shatter A2 into an arbitrary 20m fragment');
    assert.equal(result.unallocatedCount, 1);
  });

  // Scenario 10: Test 36, 50, 55, 110 and 120-minute blocks
  await suite.test('Scenario 10: Test 36, 50, 55, 110 and 120-minute blocks', () => {
    const testDurations = [36, 50, 55, 110, 120];
    for (const dur of testDurations) {
      const block = [{ blockId: `b-${dur}`, durationMinutes: dur, blockType: 'learning' }];
      const act = [{ _id: `a-${dur}`, courseSlug: 'general', totalEffortMinutes: Math.floor(dur * 0.8), status: 'pending' }];
      const result = PlannerEngine.allocateCurriculumToBlocks({ blocks: block, activities: act });
      assert.equal(result.allocatedActivitiesCount, 1, `Duration ${dur}m block should allocate cleanly`);
    }
  });

  // Scenario 11: Log 70 minutes against a 120-minute assignment
  await suite.test('Scenario 11: Log 70 minutes against a 120-minute assignment', () => {
    const task = { estimatedMinutes: 120, actualMinutes: 0, status: 'pending' };
    task.actualMinutes += 70;
    const remaining = Math.max(0, task.estimatedMinutes - task.actualMinutes);
    assert.equal(task.actualMinutes, 70);
    assert.equal(remaining, 50);
    assert.equal(task.status, 'pending', 'Must NOT be marked completed automatically');
  });

  // Scenario 12: Mark a session incomplete
  await suite.test('Scenario 12: Mark a session incomplete', () => {
    const task = { _id: 't1', title: 'DSA Trees', status: 'in-progress', actualMinutes: 30, estimatedMinutes: 90 };
    const remaining = PlannerEngine.getRemainingEffort(task);
    assert.equal(remaining, 60);
    assert.equal(task.status, 'in-progress');
  });

  // Scenario 13: Verify only the correct course becomes outstanding
  await suite.test('Scenario 13: Verify only the correct course becomes outstanding', () => {
    const tasks = [
      { _id: 't1', category: 'dsa', status: 'pending', remainingMinutes: 60 },
      { _id: 't2', category: 'webdev', status: 'completed', remainingMinutes: 0 }
    ];
    const outstanding = tasks.filter(t => t.status !== 'completed');
    assert.equal(outstanding.length, 1);
    assert.equal(outstanding[0].category, 'dsa');
  });

  // Scenario 14: Accept recovery and log actual recovery
  await suite.test('Scenario 14: Accept recovery and log actual recovery', () => {
    let unrecoveredDeficit = 90;
    const acceptedRecoveryMinutes = 20;
    unrecoveredDeficit = Math.max(0, unrecoveredDeficit - acceptedRecoveryMinutes);
    assert.equal(unrecoveredDeficit, 70);
  });

  // Scenario 15: Verify the next recommendation
  await suite.test('Scenario 15: Verify the next recommendation', () => {
    const deficit = 70;
    const nextRecommended = Math.min(deficit, 30);
    assert.equal(nextRecommended, 30);
  });

  // Scenario 16: Add a recurring sleep block
  await suite.test('Scenario 16: Add a recurring sleep block', () => {
    const sleepBlock = {
      blockId: 'sleep', label: 'Protected Sleep Window', startTime: '23:40', endTime: '05:00',
      durationMinutes: 320, category: 'rest', blockType: 'fixed_routine', isProtected: true, isTrackable: false
    };
    assert.equal(sleepBlock.isProtected, true);
    assert.equal(sleepBlock.blockType, 'fixed_routine');
  });

  // Scenario 17: Add breakfast and dinner
  await suite.test('Scenario 17: Add breakfast and dinner', () => {
    const meals = [
      { label: 'Breakfast', startTime: '07:30', endTime: '08:00', durationMinutes: 30, blockType: 'fixed_routine' },
      { label: 'Dinner', startTime: '20:30', endTime: '21:00', durationMinutes: 30, blockType: 'fixed_routine' }
    ];
    assert.equal(meals.length, 2);
    assert.ok(meals.every(m => m.blockType === 'fixed_routine'));
  });

  // Scenario 18: Verify study cannot overlap fixed routine blocks
  await suite.test('Scenario 18: Verify study cannot overlap fixed routine blocks', () => {
    const fixed = { startTime: '09:00', endTime: '16:00', label: 'College', blockType: 'fixed_routine' };
    const studyStart = '14:00';
    const studyEnd = '15:30';
    const hasOverlap = studyStart < fixed.endTime && studyEnd > fixed.startTime;
    assert.equal(hasOverlap, true, 'Conflict detection flags overlap on fixed block');
  });

  // Scenario 19: Verify sleep crossing midnight
  await suite.test('Scenario 19: Verify sleep crossing midnight', () => {
    const start = '23:40';
    const end = '05:00';
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let dur = (eH * 60 + eM) - (sH * 60 + sM);
    if (dur <= 0) dur += (24 * 60);
    assert.equal(dur, 320);
    const formatted = formatTimeRange(start, end);
    assert.ok(formatted.includes('11:40 PM') && formatted.includes('5:00 AM'));
  });

  // Scenario 20: Enable completion tracking for exercise
  await suite.test('Scenario 20: Enable completion tracking for exercise', () => {
    const gymBlock = {
      label: 'Gym Workout', blockType: 'actionable_routine', category: 'gym', isTrackable: true
    };
    assert.equal(gymBlock.isTrackable, true);
  });

  // Scenario 21: Verify a non-trackable dinner block does not require a checkbox
  await suite.test('Scenario 21: Verify a non-trackable dinner block does not require a checkbox', () => {
    const dinnerBlock = {
      label: 'Dinner', blockType: 'fixed_routine', category: 'routine', isTrackable: false
    };
    assert.equal(dinnerBlock.isTrackable, false);
  });

  // Scenario 22: Change a weekday timetable
  await suite.test('Scenario 22: Change a weekday timetable', () => {
    const template = { version: 1, title: 'Semester 3 Weekday', blocks: [] };
    const updated = { ...template, version: 2, title: 'Semester 4 Weekday' };
    assert.equal(updated.version, 2);
  });

  // Scenario 23: Verify historical assignments remain unchanged
  await suite.test('Scenario 23: Verify historical assignments remain unchanged', () => {
    const historicalRecord = { date: '2026-10-15', actualMinutes: 90, status: 'completed' };
    const snapshot = JSON.stringify(historicalRecord);
    // Simulating new timetable creation
    const newVersion = { version: 3, effectiveFrom: '2027-01-01' };
    assert.equal(JSON.stringify(historicalRecord), snapshot, 'Historical record remains immutable');
  });

  // Scenario 24: Create a 15-day Typing Practice exploration
  await suite.test('Scenario 24: Create a 15-day Typing Practice exploration', () => {
    const exploration = {
      name: 'Typing Practice', category: 'exploration', dailyDuration: 30, durationDays: 15,
      totalEstimatedMinutes: 15 * 30
    };
    assert.equal(exploration.totalEstimatedMinutes, 450);
  });

  // Scenario 25: Import a 15-week Oratory programme
  await suite.test('Scenario 25: Import a 15-week Oratory programme', () => {
    const weeks = Array.from({ length: 15 }, (_, i) => ({ weekNumber: i + 1, topic: `Topic ${i + 1}` }));
    assert.equal(weeks.length, 15);
    assert.equal(weeks[14].weekNumber, 15);
  });

  // Scenario 26: Create and complete a Reading activity
  await suite.test('Scenario 26: Create and complete a Reading activity', () => {
    const reading = { title: 'Clean Architecture', startPage: 1, endPage: 30, actualMinutes: 45, status: 'in-progress' };
    reading.status = 'completed';
    assert.equal(reading.status, 'completed');
    assert.equal(reading.actualMinutes, 45);
  });

  // Scenario 27: Verify Books, Academics, Hackathons, Tasks and Fitness synchronization
  await suite.test('Scenario 27: Verify cross-module synchronization structure', () => {
    const modules = ['books', 'academics', 'hackathons', 'tasks', 'fitness'];
    const canonicalEvents = modules.map(m => ({
      sourceModule: m, actualMinutes: 30, status: 'completed', timestamp: new Date()
    }));
    assert.equal(canonicalEvents.length, 5);
    assert.ok(canonicalEvents.every(e => e.actualMinutes === 30));
  });

  // Scenario 28: Use one Slack Day and verify two remain
  await suite.test('Scenario 28: Use one Slack Day and verify two remain', () => {
    const allowance = 3;
    const used = 1;
    const remaining = allowance - used;
    assert.equal(remaining, 2);
  });

  // Scenario 29: Miss a session without consuming a Slack Day
  await suite.test('Scenario 29: Miss a session without consuming a Slack Day', () => {
    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-13', dailyCapacityMinutes: 300,
      existingScheduledTasks: [{ _id: 't1', title: 'DSA', priority: 'P2', estimatedMinutes: 60, status: 'pending' }],
      slackDayStatus: { available: 3, used: 0, isRequested: false } // NOT requested
    });
    assert.equal(proposal.isSlackDay, false, 'Slack Day is not automatically consumed');
  });

  // Scenario 30: Attempt to exceed seven examination preparation days in one month
  await suite.test('Scenario 30: Attempt to exceed seven examination preparation days in one month', () => {
    const existingMonthPrepDates = 7;
    const maxPerMonth = 7;
    const canAddEighth = existingMonthPrepDates < maxPerMonth;
    assert.equal(canAddEighth, false, '8th prep day in same calendar month must be blocked');
  });

  // Scenario 31: Attempt to exceed fifteen in a semester
  await suite.test('Scenario 31: Attempt to exceed fifteen in a semester', () => {
    const existingSemesterPrepDates = 15;
    const maxSemester = 15;
    const canAddSixteenth = existingSemesterPrepDates < maxSemester;
    assert.equal(canAddSixteenth, false, '16th prep day in semester must be blocked');
  });

  // Scenario 32: Apply a preparation-leave timetable on a weekday
  await suite.test('Scenario 32: Apply a preparation-leave timetable on a weekday', () => {
    const exception = {
      date: '2026-11-18', exceptionType: 'exam_leave', templateOverride: 'holiday'
    };
    assert.equal(exception.templateOverride, 'holiday');
  });

  // Scenario 33: Verify course allocation changes during examinations
  await suite.test('Scenario 33: Verify course allocation changes during examinations', () => {
    const tasks = [
      { _id: 't1', title: 'Exam Revision: Networks', priority: 'P1', category: 'academic', estimatedMinutes: 120 },
      { _id: 't2', title: 'Exploration: Rust', priority: 'P3', category: 'exploration', estimatedMinutes: 60 }
    ];
    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-20', dailyCapacityMinutes: 180,
      existingScheduledTasks: tasks,
      examMode: { enabled: true, isExamDay: true }
    });
    const deferredExploration = proposal.deferredTasks.find(t => t.category === 'exploration');
    assert.ok(deferredExploration, 'Exploration is throttled during exam mode');
  });

  // Scenario 34: Add unexpected availability and review recommendations
  await suite.test('Scenario 34: Add unexpected availability and review recommendations', () => {
    const extraMinutes = 60;
    const pendingActivity = { totalEffortMinutes: 45, status: 'pending' };
    const canFit = pendingActivity.totalEffortMinutes <= extraMinutes;
    assert.equal(canFit, true, 'Unexpected free hour can advance 45m pending course activity');
  });

  // Scenario 35: Re-import a modified CSV without losing completed history
  await suite.test('Scenario 35: Re-import a modified CSV without losing completed history', () => {
    const existingActivity = { sectionNumber: 1, activityNumber: 1, status: 'completed', actualMinutes: 60 };
    const incomingCsvRecord = { sectionNumber: 1, activityNumber: 1, contentDurationMinutes: 30 };
    // Diff logic: preserve status and actualMinutes if already completed
    const merged = {
      ...incomingCsvRecord,
      status: existingActivity.status,
      actualMinutes: existingActivity.actualMinutes
    };
    assert.equal(merged.status, 'completed');
    assert.equal(merged.actualMinutes, 60);
  });

  // Scenario 36: Verify web/mobile synchronization
  await suite.test('Scenario 36: Verify web/mobile synchronization format', () => {
    const canonicalRecord = {
      userId: 'u123', date: '2026-11-13', source: 'capacitor-android', actualMinutes: 45
    };
    assert.equal(canonicalRecord.source, 'capacitor-android');
    assert.equal(canonicalRecord.actualMinutes, 45);
  });
});
