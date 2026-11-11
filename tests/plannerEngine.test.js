import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlannerEngine } from '../server/services/plannerEngine.js';

describe('SARTHI Planner Engine — Capacity & Recovery Rules', () => {

  it('1. Partial Completion: Preserves completed minutes and schedules only remaining effort', () => {
    const task = {
      _id: 'task-1',
      title: 'Chai aur Code DOM Project',
      priority: 'P2',
      estimatedMinutes: 90,
      actualMinutes: 40,
      status: 'in-progress'
    };

    const remaining = PlannerEngine.getRemainingEffort(task);
    assert.equal(remaining, 50, 'Remaining effort must be 90 - 40 = 50 min');

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-17',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: [],
      missedOrUnfinishedTasks: [task]
    });

    assert.equal(proposal.acceptedTasks.length, 1);
    assert.equal(proposal.allocatedMinutes, 50);
    assert.match(proposal.reasons[0], /Preserved 40 min of completed work/);
  });

  it('2. Fully Missed Day: Does not dump all missed work if capacity is exceeded; defers P3 first', () => {
    const missedTasks = [
      { _id: 'p1-1', title: 'Operating Systems Lab Submission', priority: 'P1', estimatedMinutes: 120, actualMinutes: 0 },
      { _id: 'p2-1', title: 'DSA Binary Search Tree Practice', priority: 'P2', estimatedMinutes: 150, actualMinutes: 0 },
      { _id: 'p3-1', title: 'Watch Tech Conference Keynote', priority: 'P3', estimatedMinutes: 90, actualMinutes: 0 },
      { _id: 'p3-2', title: 'Organise Notion Workspace', priority: 'P3', estimatedMinutes: 60, actualMinutes: 0 }
    ];

    // Total missed effort = 120 + 150 + 90 + 60 = 420 min
    // Daily capacity is 300 min + 60 min catchup buffer = 360 min limit
    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-17',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: [],
      missedOrUnfinishedTasks: missedTasks,
      maxCatchupMinutes: 60
    });

    // P1 (120) + P2 (150) = 270 min <= 300 min (fits!)
    // P3 tasks (90 + 60 = 150 min) would bring total to 420 min > 360 min -> DEFERRED!
    assert.equal(proposal.acceptedTasks.length, 2);
    assert.deepEqual(proposal.acceptedTasks.map(t => t.priority).sort(), ['P1', 'P2']);
    assert.equal(proposal.deferredTasks.length, 2);
    assert.deepEqual(proposal.deferredTasks.map(t => t.priority), ['P3', 'P3']);
    assert.equal(proposal.allocatedMinutes, 270);
  });

  it('3. Essential (P1) Protection: P1 tasks are never dropped silently', () => {
    const heavyP1Task = {
      _id: 'p1-heavy',
      title: 'End-Sem Project Final Viva Prep',
      priority: 'P1',
      estimatedMinutes: 400,
      actualMinutes: 0,
      isProtected: true
    };

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-17',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: [heavyP1Task],
      missedOrUnfinishedTasks: []
    });

    // Even if exceeding capacity (400 > 360), P1 is kept and warning is issued
    assert.equal(proposal.acceptedTasks.length, 1);
    assert.equal(proposal.acceptedTasks[0]._id, 'p1-heavy');
    assert.ok(proposal.warnings.length > 0);
    assert.match(proposal.warnings[0], /CRITICAL CAPACITY OVERLOAD/);
  });

  it('4. Dependencies: Prerequisite task must be completed before dependent task is scheduled', () => {
    const parentTask = {
      _id: 'dep-parent',
      title: 'Setup MongoDB Mongoose Models',
      priority: 'P1',
      estimatedMinutes: 60,
      status: 'pending' // not completed!
    };

    const childTask = {
      _id: 'dep-child',
      title: 'Build Express Controller Logic',
      priority: 'P1',
      estimatedMinutes: 60,
      dependencies: ['dep-parent'],
      status: 'pending'
    };

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-17',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: [parentTask],
      missedOrUnfinishedTasks: [childTask]
    });

    // childTask should be held because dep-parent is not finished
    const acceptedIds = proposal.acceptedTasks.map(t => t._id);
    assert.ok(acceptedIds.includes('dep-parent'));
    assert.ok(!acceptedIds.includes('dep-child'), 'Dependent task must NOT be scheduled while prerequisite is pending');
  });

  it('5. Slack Days: Activates recovery buffer when allowance is available', () => {
    const scheduled = [
      { _id: 't-1', title: 'WebDev Lecture', priority: 'P2', estimatedMinutes: 60 },
      { _id: 't-2', title: 'Gym Workout', priority: 'P2', estimatedMinutes: 60 }
    ];

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-17',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: scheduled,
      slackDayStatus: { available: 3, used: 1, isRequested: true }
    });

    assert.equal(proposal.isSlackDay, true);
    assert.equal(proposal.acceptedTasks.length, 0);
    assert.equal(proposal.deferredTasks.length, 2);
    assert.match(proposal.reasons[0], /Slack Day activated/);
  });

  it('6. Exhausted Slack Days: Reverts to standard recovery with warning when allowance is 0', () => {
    const scheduled = [
      { _id: 't-1', title: 'WebDev Lecture', priority: 'P1', estimatedMinutes: 60 }
    ];

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-17',
      dailyCapacityMinutes: 300,
      existingScheduledTasks: scheduled,
      slackDayStatus: { available: 0, used: 4, isRequested: true }
    });

    assert.equal(proposal.isSlackDay, false);
    assert.equal(proposal.acceptedTasks.length, 1);
    assert.ok(proposal.warnings.some(w => w.includes('exhausted')));
  });

  it('7. Deadline Ordering: Earlier deadline is prioritised over later deadline', () => {
    const taskA = { _id: 't-a', title: 'Assignment Due Tomorrow', deadline: '2026-11-18', priority: 'P2', estimatedMinutes: 60 };
    const taskB = { _id: 't-b', title: 'Assignment Due in 5 Days', deadline: '2026-11-22', priority: 'P1', estimatedMinutes: 60 };

    const ranked = PlannerEngine.rankTasks([taskB, taskA]);
    assert.equal(ranked[0]._id, 't-a', 'Earlier deadline should take precedence');
  });

  it('8. Catchup Distribution: Spreads deferred tasks across available capacity of upcoming days', () => {
    const deferredTasks = [
      { _id: 'def-1', title: 'Task 1', priority: 'P2', estimatedMinutes: 60 },
      { _id: 'def-2', title: 'Task 2', priority: 'P2', estimatedMinutes: 90 },
      { _id: 'def-3', title: 'Task 3', priority: 'P3', estimatedMinutes: 120 }
    ];

    const upcomingDays = [
      { date: '2026-11-18', capacityMinutes: 300, scheduledMinutes: 260 }, // 40 min free (cannot take 60 min task)
      { date: '2026-11-19', capacityMinutes: 300, scheduledMinutes: 180 }, // 120 min free (can take 60 min, remaining 60)
      { date: '2026-11-20', capacityMinutes: 300, scheduledMinutes: 150 }  // 150 min free (can take 90 min)
    ];

    const { distributionPlan, unplacedTasks } = PlannerEngine.distributeCatchup({
      deferredTasks,
      upcomingDaysSchedules: upcomingDays,
      dailyMaxWorkMinutes: 480
    });

    assert.ok(distributionPlan.length >= 2, 'Should place feasible tasks in free slots');
    assert.equal(distributionPlan[0].taskId, 'def-1');
    assert.equal(distributionPlan[0].targetDate, '2026-11-19');
    assert.equal(distributionPlan[1].taskId, 'def-2');
    assert.equal(distributionPlan[1].targetDate, '2026-11-20');
  });

  it('9. User Replan Customization: Moving tasks between accepted and deferred updates allocations accurately', () => {
    const task1 = { _id: 't-1', title: 'Task 1', priority: 'P2', estimatedMinutes: 60 };
    const task2 = { _id: 't-2', title: 'Task 2', priority: 'P2', estimatedMinutes: 90 };
    const task3 = { _id: 't-3', title: 'Task 3', priority: 'P3', estimatedMinutes: 45 };

    const proposal = PlannerEngine.generateReplanProposal({
      targetDate: '2026-11-17',
      dailyCapacityMinutes: 160,
      existingScheduledTasks: [],
      missedOrUnfinishedTasks: [task1, task2, task3]
    });

    // Initially task1 (60) + task2 (90) = 150 <= 160 (accepted), task3 (45) deferred
    assert.equal(proposal.acceptedTasks.length, 2);
    assert.equal(proposal.deferredTasks.length, 1);
    assert.equal(proposal.allocatedMinutes, 150);

    // Simulate user editing: move task2 (90m) to deferred, move task3 (45m) to accepted
    const idx2 = proposal.acceptedTasks.findIndex(t => t._id === 't-2');
    const [movedToDeferred] = proposal.acceptedTasks.splice(idx2, 1);
    proposal.deferredTasks.push(movedToDeferred);

    const idx3 = proposal.deferredTasks.findIndex(t => t._id === 't-3');
    const [movedToAccepted] = proposal.deferredTasks.splice(idx3, 1);
    proposal.acceptedTasks.push(movedToAccepted);

    // Recalculate allocation
    const newAllocated = proposal.acceptedTasks.reduce((sum, t) => sum + (t.remainingMinutes || t.estimatedMinutes), 0);
    assert.equal(newAllocated, 60 + 45, 'New allocation must be 105 min');
    assert.ok(newAllocated <= proposal.capacityMinutes, 'User custom plan fits within capacity');
  });

});
