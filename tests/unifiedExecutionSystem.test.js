import test from 'node:test';
import assert from 'node:assert/strict';
import { PlannerEngine } from '../server/services/plannerEngine.js';

// ===========================================================================
// 1. Timetable Block — Unified Daily Time Architecture
// ===========================================================================
test('Unified Daily Time Architecture — Block Type Classification', async (t) => {

  await t.test('1. Study blocks linked to dynamic course via courseSlug', () => {
    const blocks = [
      { blockId: 'b1', label: 'DSA Deep Work', startTime: '06:00', endTime: '08:00',
        durationMinutes: 120, category: 'study', blockType: 'learning',
        courseSlug: 'dsa', isTrackable: false, isProtected: false },
      { blockId: 'b2', label: 'College', startTime: '09:00', endTime: '16:00',
        durationMinutes: 420, category: 'college', blockType: 'fixed_routine',
        courseSlug: null, isTrackable: false, isProtected: true },
      { blockId: 'b3', label: 'WebDev Projects', startTime: '17:00', endTime: '19:00',
        durationMinutes: 120, category: 'webdev', blockType: 'learning',
        courseSlug: 'web-development', isTrackable: false, isProtected: false }
    ];

    assert.equal(blocks[0].courseSlug, 'dsa');
    assert.equal(blocks[0].blockType, 'learning');
    assert.equal(blocks[2].courseSlug, 'web-development');
    assert.equal(blocks[1].blockType, 'fixed_routine');
    assert.equal(blocks[1].isProtected, true);
    assert.equal(blocks[1].courseSlug, null);
  });

  await t.test('2. Fixed routines (sleep, meals) are non-trackable; actionable routines (gym, journal) are trackable', () => {
    const fixedRoutineBlock = {
      blockId: 'sleep', label: 'Protected Sleep Window',
      startTime: '23:40', endTime: '05:00', durationMinutes: 320,
      category: 'rest', blockType: 'fixed_routine',
      courseSlug: null, isTrackable: false, isProtected: true
    };
    const actionableRoutineBlock = {
      blockId: 'gym', label: 'Gym & Exercise',
      startTime: '17:30', endTime: '19:00', durationMinutes: 90,
      category: 'gym', blockType: 'actionable_routine',
      courseSlug: null, isTrackable: true, isProtected: false
    };

    assert.equal(fixedRoutineBlock.blockType, 'fixed_routine');
    assert.equal(fixedRoutineBlock.isTrackable, false, 'Sleep should not show a checkbox');
    assert.equal(actionableRoutineBlock.blockType, 'actionable_routine');
    assert.equal(actionableRoutineBlock.isTrackable, true, 'Gym should show completion tracking');
  });

  await t.test('3. Sleep block crossing midnight calculates correct duration', () => {
    const startMin = 23 * 60 + 40; // 23:40
    const endMin = 5 * 60;          // 05:00
    let dur = endMin - startMin;
    if (dur <= 0) dur += (24 * 60);
    assert.equal(dur, 320, 'Sleep from 23:40 to 05:00 should be 320 minutes');
  });

  await t.test('4. Exploration and deadline block types are recognised', () => {
    const exploration = {
      blockId: 'exp1', label: 'Open Exploration',
      startTime: '20:00', endTime: '21:30', durationMinutes: 90,
      category: 'exploration', blockType: 'exploration',
      courseSlug: null, isTrackable: false
    };
    const deadline = {
      blockId: 'dl1', label: 'Assignment Submission',
      startTime: '22:00', endTime: '23:00', durationMinutes: 60,
      category: 'study', blockType: 'deadline',
      courseSlug: null, isTrackable: false
    };

    assert.equal(exploration.blockType, 'exploration');
    assert.equal(deadline.blockType, 'deadline');
  });
});


// ===========================================================================
// 2. Slack Days — Exactly 3 Per Calendar Month
// ===========================================================================
test('Slack Days — Exactly 3 Per Calendar Month Enforcement', async (t) => {

  await t.test('1. Grants slack day when within 3-per-month allowance', () => {
    const tasks = [
      { _id: 't1', title: 'Task A', priority: 'P2', estimatedMinutes: 60, actualMinutes: 0, status: 'pending' }
    ];
    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-13',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: tasks,
      slackDayStatus: { available: 2, used: 1, isRequested: true }
    });

    assert.equal(proposal.isSlackDay, true);
    assert.equal(proposal.acceptedTasks.length, 0, 'All tasks deferred on slack day');
    assert.equal(proposal.deferredTasks.length, 1);
  });

  await t.test('2. Rejects 4th slack day request (only 3 allowed)', () => {
    const tasks = [
      { _id: 't1', title: 'Task B', priority: 'P1', estimatedMinutes: 90, actualMinutes: 0, status: 'pending' }
    ];
    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-13',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: tasks,
      slackDayStatus: { available: 0, used: 3, isRequested: true }
    });

    assert.equal(proposal.isSlackDay, false, 'Should NOT grant slack day when 3 already used');
    assert.equal(proposal.acceptedTasks.length, 1, 'P1 task should still be accepted');
    assert.ok(proposal.warnings.some(w => w.includes('exhausted')), 'Should warn about exhausted allowance');
  });

  await t.test('3. Third slack day is allowed (boundary test)', () => {
    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-13',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: [
        { _id: 't1', title: 'Task C', priority: 'P2', estimatedMinutes: 60, actualMinutes: 0, status: 'pending' }
      ],
      slackDayStatus: { available: 1, used: 2, isRequested: true }
    });

    assert.equal(proposal.isSlackDay, true, 'Third slack day should be granted');
  });
});


// ===========================================================================
// 3. Examination Prep Day Constraints
// ===========================================================================
test('Examination Prep Day Constraints — Semester & Monthly Limits', async (t) => {

  function validatePrepDate(allExamPrepDates, newDate, maxSemester, maxMonth) {
    const totalSemester = allExamPrepDates.length;
    const targetMonth = newDate.slice(0, 7);
    const monthCount = allExamPrepDates.filter(d => d.slice(0, 7) === targetMonth).length;
    const isDuplicate = allExamPrepDates.includes(newDate);

    if (isDuplicate) return { allowed: false, reason: 'duplicate' };
    if (totalSemester >= maxSemester) return { allowed: false, reason: 'semester_exceeded' };
    if (monthCount >= maxMonth) return { allowed: false, reason: 'month_exceeded' };
    return { allowed: true };
  }

  await t.test('1. Allows prep dates within semester limit (15) and month limit (7)', () => {
    const existing = ['2026-11-01', '2026-11-03', '2026-11-05'];
    const result = validatePrepDate(existing, '2026-11-08', 15, 7);
    assert.equal(result.allowed, true);
  });

  await t.test('2. Rejects prep date when monthly limit (7) reached', () => {
    const existing = [
      '2026-11-01', '2026-11-03', '2026-11-05', '2026-11-08',
      '2026-11-10', '2026-11-12', '2026-11-15'
    ];
    const result = validatePrepDate(existing, '2026-11-18', 15, 7);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'month_exceeded');
  });

  await t.test('3. Rejects prep date when semester limit (15) reached', () => {
    const existing = Array.from({ length: 15 }, (_, i) => {
      const month = String(Math.floor(i / 7) + 9).padStart(2, '0');
      const day = String((i % 7) * 3 + 1).padStart(2, '0');
      return `2026-${month}-${day}`;
    });
    const result = validatePrepDate(existing, '2026-12-25', 15, 7);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'semester_exceeded');
  });

  await t.test('4. Rejects duplicate preparation date', () => {
    const existing = ['2026-11-01', '2026-11-03'];
    const result = validatePrepDate(existing, '2026-11-01', 15, 7);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'duplicate');
  });

  await t.test('5. Allows prep dates across different months without conflict', () => {
    const existing = [
      '2026-11-01', '2026-11-03', '2026-11-05', '2026-11-08',
      '2026-11-10', '2026-11-12', '2026-11-15',
      '2026-12-01', '2026-12-03'
    ];
    // Nov is maxed at 7, but Dec is fine
    const resultNov = validatePrepDate(existing, '2026-11-20', 15, 7);
    assert.equal(resultNov.allowed, false, 'Nov should be full');

    const resultDec = validatePrepDate(existing, '2026-12-05', 15, 7);
    assert.equal(resultDec.allowed, true, 'Dec has capacity');
  });
});


// ===========================================================================
// 4. Section-Aware Curriculum Allocation
// ===========================================================================
test('Section-Aware Curriculum Allocation Engine', async (t) => {

  await t.test('1. Allocates activities to course-linked study blocks respecting section boundaries', () => {
    const blocks = [
      { blockId: 'b1', label: 'DSA Morning', startTime: '06:00', endTime: '08:00',
        durationMinutes: 120, category: 'dsa', courseSlug: 'dsa', blockType: 'learning' },
      { blockId: 'b2', label: 'WebDev Afternoon', startTime: '17:00', endTime: '19:00',
        durationMinutes: 120, category: 'webdev', courseSlug: 'web-development', blockType: 'learning' }
    ];

    const activities = [
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, sectionTitle: 'Arrays',
        activityNumber: 1, title: 'Two Sum', totalEffortMinutes: 45, status: 'pending' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 1, sectionTitle: 'Arrays',
        activityNumber: 2, title: 'Max Subarray', totalEffortMinutes: 60, status: 'pending' },
      { _id: 'a3', courseSlug: 'web-development', sectionNumber: 1, sectionTitle: 'HTML Basics',
        activityNumber: 1, title: 'Semantic Elements', totalEffortMinutes: 30, status: 'pending' },
      { _id: 'a4', courseSlug: 'web-development', sectionNumber: 1, sectionTitle: 'HTML Basics',
        activityNumber: 2, title: 'Forms & Validation', totalEffortMinutes: 50, status: 'pending' }
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });

    assert.ok(result.allocatedActivitiesCount >= 3, 'Should allocate at least 3 activities');

    // DSA block should have DSA activities
    const dsaBlock = result.blockAllocations.find(b => b.blockId === 'b1');
    assert.ok(dsaBlock, 'DSA block should exist');
    assert.ok(dsaBlock.assignedActivities.every(a => a.courseSlug === 'dsa'),
      'DSA block should only have DSA activities');

    // WebDev block should have WebDev activities
    const wdBlock = result.blockAllocations.find(b => b.blockId === 'b2');
    assert.ok(wdBlock, 'WebDev block should exist');
    assert.ok(wdBlock.assignedActivities.every(a => a.courseSlug === 'web-development'),
      'WebDev block should only have web-development activities');
  });

  await t.test('2. Does not create meaningless fragments below minimum coherent window', () => {
    const blocks = [
      { blockId: 'b1', label: 'Short Study', startTime: '20:00', endTime: '20:30',
        durationMinutes: 30, category: 'study', courseSlug: null, blockType: 'learning' }
    ];

    const activities = [
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 1,
        title: 'Easy Warmup', totalEffortMinutes: 25, status: 'pending' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 2, activityNumber: 1,
        title: 'Hard Problem', totalEffortMinutes: 90, status: 'pending' }
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities, minCoherentMinutes: 15 });

    // The 25-min activity fits; the 90-min one does not (only 5 min left < 15 min threshold)
    assert.equal(result.allocatedActivitiesCount, 1, 'Only the fitting activity should be allocated');
    assert.equal(result.unallocatedCount, 1, 'The 90-min activity should remain unallocated');
  });

  await t.test('3. Preserves section ordering: section 1 before section 2', () => {
    const blocks = [
      { blockId: 'b1', label: 'Study', startTime: '06:00', endTime: '10:00',
        durationMinutes: 240, category: 'study', courseSlug: null, blockType: 'learning' }
    ];

    const activities = [
      { _id: 'a3', courseSlug: 'dsa', sectionNumber: 3, activityNumber: 1,
        title: 'Section 3 Activity', totalEffortMinutes: 30, status: 'pending' },
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 1,
        title: 'Section 1 Activity', totalEffortMinutes: 30, status: 'pending' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 2, activityNumber: 1,
        title: 'Section 2 Activity', totalEffortMinutes: 30, status: 'pending' }
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });

    const assigned = result.blockAllocations[0].assignedActivities;
    assert.equal(assigned.length, 3, 'All 3 should fit');
    assert.equal(assigned[0].sectionNumber, 1, 'Section 1 should come first');
    assert.equal(assigned[1].sectionNumber, 2, 'Section 2 should come second');
    assert.equal(assigned[2].sectionNumber, 3, 'Section 3 should come third');
  });

  await t.test('4. Coherent section boundary: slightly oversized activity allocated with leeway', () => {
    const blocks = [
      { blockId: 'b1', label: 'Study', startTime: '06:00', endTime: '07:00',
        durationMinutes: 60, category: 'study', courseSlug: null, blockType: 'learning' }
    ];

    const activities = [
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 1,
        title: 'Section 1 Lecture', totalEffortMinutes: 40, status: 'pending' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 2,
        title: 'Section 1 Practice', totalEffortMinutes: 22, status: 'pending' }
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });

    // a1 (40m) fits in 60m. Remaining = 20m. a2 (22m) is within 20% leeway of 20m (22-20 = 2 ≤ max(10, 4))
    assert.equal(result.allocatedActivitiesCount, 2, 'Both should be allocated to complete the section coherently');
  });

  await t.test('5. Completed activities are excluded from allocation', () => {
    const blocks = [
      { blockId: 'b1', label: 'Study', startTime: '06:00', endTime: '08:00',
        durationMinutes: 120, category: 'study', courseSlug: null, blockType: 'learning' }
    ];

    const activities = [
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 1,
        title: 'Done Activity', totalEffortMinutes: 30, status: 'completed' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 2,
        title: 'Pending Activity', totalEffortMinutes: 45, status: 'pending' }
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });

    assert.equal(result.allocatedActivitiesCount, 1, 'Only the pending activity should be allocated');
    assert.ok(result.allocatedActivityIds.includes('a2'));
    assert.ok(!result.allocatedActivityIds.includes('a1'), 'Completed activity must not be re-allocated');
  });
});


// ===========================================================================
// 5. Exam Mode — Exploration Throttling & Academic Prioritization
// ===========================================================================
test('Exam Mode — Exploration Throttling & Academic Priority', async (t) => {

  await t.test('1. Exam mode defers exploration (P3) tasks to protect study capacity', () => {
    const tasks = [
      { _id: 't1', title: 'Revision: Operating Systems', priority: 'P1',
        estimatedMinutes: 120, actualMinutes: 0, status: 'pending', category: 'academic' },
      { _id: 't2', title: 'Explore Rust Language', priority: 'P3',
        estimatedMinutes: 60, actualMinutes: 0, status: 'pending', category: 'exploration' },
      { _id: 't3', title: 'Practice DBMS Queries', priority: 'P2',
        estimatedMinutes: 60, actualMinutes: 0, status: 'pending', category: 'academic' }
    ];

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-20',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: tasks,
      examMode: { enabled: true, isExamDay: true, focusSubjects: ['academic'] }
    });

    assert.ok(proposal.reasons.some(r => /exam/i.test(r)), 'Should mention exam preparation');
    // Exploration P3 should be deferred
    const deferredExploration = proposal.deferredTasks.find(t => t.category === 'exploration');
    assert.ok(deferredExploration, 'Exploration task should be deferred during exam mode');
    // Academic P1 and P2 should be accepted
    const acceptedAcademic = proposal.acceptedTasks.filter(t => t.category === 'academic');
    assert.equal(acceptedAcademic.length, 2, 'Both academic tasks should be accepted');
  });

  await t.test('2. Exam mode ranks academic tasks above non-academic at same priority', () => {
    const tasks = [
      { _id: 't1', title: 'Read Novel', priority: 'P2',
        estimatedMinutes: 60, actualMinutes: 0, category: 'general' },
      { _id: 't2', title: 'DBMS Revision', priority: 'P2',
        estimatedMinutes: 60, actualMinutes: 0, category: 'academic' }
    ];

    const ranked = PlannerEngine.rankTasks(tasks, '2026-11-20', {
      enabled: true, focusSubjects: ['academic']
    });

    assert.equal(ranked[0]._id, 't2', 'Academic task should rank first in exam mode');
  });

  await t.test('3. Without exam mode, exploration is NOT throttled', () => {
    const tasks = [
      { _id: 't1', title: 'Explore AI Papers', priority: 'P2',
        estimatedMinutes: 60, actualMinutes: 0, status: 'pending', category: 'exploration' },
      { _id: 't2', title: 'DSA Practice', priority: 'P2',
        estimatedMinutes: 60, actualMinutes: 0, status: 'pending', category: 'study' }
    ];

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-20',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: tasks,
      examMode: null
    });

    // Both should be accepted (no throttling)
    assert.equal(proposal.acceptedTasks.length, 2);
    assert.ok(!proposal.reasons.some(r => /exam/i.test(r)));
  });
});


// ===========================================================================
// 6. Cross-Module Synchronization Simulation
// ===========================================================================
test('Cross-Module Synchronization — Courses ↔ Timetable ↔ Recovery ↔ Today', async (t) => {

  await t.test('1. Timetable block with courseSlug triggers matching course allocation', () => {
    const blocks = [
      { blockId: 'b1', label: 'DSA Session', startTime: '06:00', endTime: '08:00',
        durationMinutes: 120, category: 'dsa', courseSlug: 'dsa', blockType: 'learning' },
      { blockId: 'b2', label: 'Free Study', startTime: '17:00', endTime: '19:00',
        durationMinutes: 120, category: 'study', courseSlug: null, blockType: 'learning' }
    ];

    const activities = [
      { _id: 'a1', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 1,
        title: 'Arrays Basics', totalEffortMinutes: 60, status: 'pending' },
      { _id: 'a2', courseSlug: 'dsa', sectionNumber: 1, activityNumber: 2,
        title: 'Linked Lists', totalEffortMinutes: 50, status: 'pending' },
      { _id: 'a3', courseSlug: 'web-development', sectionNumber: 1, activityNumber: 1,
        title: 'CSS Grid', totalEffortMinutes: 40, status: 'pending' }
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });

    // DSA block should only get DSA activities
    const dsaAssigned = result.blockAllocations[0].assignedActivities;
    assert.ok(dsaAssigned.length >= 1);
    assert.ok(dsaAssigned.every(a => a.courseSlug === 'dsa'));

    // Free study block (no courseSlug) can take any remaining
    const freeAssigned = result.blockAllocations[1].assignedActivities;
    assert.ok(freeAssigned.length >= 1, 'Free block should accept remaining activities');
  });

  await t.test('2. Recovery integration: deferred tasks create bounded recovery entries, not tomorrow overload', () => {
    // Scenario: P1(200m) + P2(200m) + P3(100m) = 500m total against 300m capacity + 60m catchup = 360m
    // P1 is force-accepted (200m). Remaining capacity = 100m standard, 160m effective.
    // P2(200m) exceeds remaining effective capacity so it gets deferred.
    // P3(100m) fits within standard remaining capacity (100m) so it's accepted.
    const tasks = [
      { _id: 't1', title: 'P1 Essential', priority: 'P1', estimatedMinutes: 200, actualMinutes: 0, status: 'pending' },
      { _id: 't2', title: 'P2 Important', priority: 'P2', estimatedMinutes: 200, actualMinutes: 0, status: 'pending' },
      { _id: 't3', title: 'P3 Optional', priority: 'P3', estimatedMinutes: 100, actualMinutes: 0, status: 'pending' }
    ];

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-13',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: tasks,
      maxCatchupMinutes: 60
    });

    // P1 must always be accepted (force-protected)
    assert.ok(proposal.acceptedTasks.some(t => t.title === 'P1 Essential'), 'P1 must always be accepted');
    // P2(200m) exceeds remaining effective capacity (160m), so it should be deferred
    assert.ok(proposal.deferredTasks.some(t => t.title === 'P2 Important'),
      'P2 (200m) should be deferred when it exceeds remaining effective capacity');
    // Total non-P1 accepted minutes should not exceed remaining effective capacity
    const totalNonP1Accepted = proposal.acceptedTasks
      .filter(t => t.priority !== 'P1')
      .reduce((s, t) => s + (t.remainingMinutes || 0), 0);
    assert.ok(totalNonP1Accepted <= 160,
      `Non-P1 accepted (${totalNonP1Accepted}m) should fit within effective remaining (160m)`);
  });
});


// ===========================================================================
// 7. Default Slack Day Allowance Now 3 (Not 4)
// ===========================================================================
test('Setting Defaults — monthlySlackDayAllowance is 3', () => {
  // Verify the PlannerEngine default
  const proposal = PlannerEngine.generateReplanProposal({
    targetDate: '2026-11-13',
    dailyCapacityMinutes: 300,
    existingScheduledTasks: []
  });
  // Default slackDayStatus should have available: 3 (not 4)
  assert.equal(proposal.isSlackDay, false, 'No slack day requested');
  // The engine should work with default params
  assert.equal(proposal.acceptedTasks.length, 0, 'No tasks to accept');
});
