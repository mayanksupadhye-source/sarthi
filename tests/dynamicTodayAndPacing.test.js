import test from 'node:test';
import assert from 'node:assert/strict';
import { PlannerEngine } from '../server/services/plannerEngine.js';

test('SARTHI Dynamic Today Timetable Allocation & Sequence Progression', async (suite) => {
  await suite.test('1. Allocates multiple sequential lectures into a single timetable block to match duration', () => {
    const blocks = [
      {
        blockId: 'blk_typing',
        label: 'Typing Practice',
        category: 'exploration',
        courseSlug: 'typing-practice',
        startTime: '16:00',
        endTime: '16:30',
        durationMinutes: 30,
        blockType: 'exploration',
      },
    ];

    const activities = [
      {
        id: 'act_1',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 1,
        title: 'Home Row Keys: ASDF JKL;',
        remainingMinutes: 10,
        totalEffortMinutes: 10,
        status: 'pending',
      },
      {
        id: 'act_2',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 2,
        title: 'Top Row Keys: QWER UIOP',
        remainingMinutes: 10,
        totalEffortMinutes: 10,
        status: 'pending',
      },
      {
        id: 'act_3',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 3,
        title: 'Bottom Row Keys: ZXCV M,.',
        remainingMinutes: 10,
        totalEffortMinutes: 10,
        status: 'pending',
      },
      {
        id: 'act_4',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 4,
        title: 'Numbers and Symbols',
        remainingMinutes: 15,
        totalEffortMinutes: 15,
        status: 'pending',
      },
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });
    assert.equal(result.blockAllocations.length, 1);
    const assigned = result.blockAllocations[0].assignedActivities;
    // 3 x 10m = 30m allocated exactly to the 30m block
    assert.equal(assigned.length, 3);
    assert.equal(assigned[0].activityId, 'act_1');
    assert.equal(assigned[1].activityId, 'act_2');
    assert.equal(assigned[2].activityId, 'act_3');
    assert.equal(result.totalAllocatedMinutes, 30);
  });

  await suite.test('2. Marking lecture 1 complete immediately advances to next lecture in sequence', () => {
    const blocks = [
      {
        blockId: 'blk_typing',
        label: 'Typing Practice',
        category: 'exploration',
        courseSlug: 'typing-practice',
        startTime: '16:00',
        endTime: '16:30',
        durationMinutes: 30,
        blockType: 'exploration',
      },
    ];

    // act_1 is completed!
    const activities = [
      {
        id: 'act_1',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 1,
        title: 'Home Row Keys: ASDF JKL;',
        remainingMinutes: 0,
        status: 'completed',
      },
      {
        id: 'act_2',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 2,
        title: 'Top Row Keys: QWER UIOP',
        remainingMinutes: 10,
        totalEffortMinutes: 10,
        status: 'pending',
      },
      {
        id: 'act_3',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 3,
        title: 'Bottom Row Keys: ZXCV M,.',
        remainingMinutes: 10,
        totalEffortMinutes: 10,
        status: 'pending',
      },
      {
        id: 'act_4',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 4,
        title: 'Numbers and Symbols',
        remainingMinutes: 10,
        totalEffortMinutes: 10,
        status: 'pending',
      },
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });
    const assigned = result.blockAllocations[0].assignedActivities;
    // Now act_2, act_3, act_4 are assigned sequentially!
    assert.equal(assigned.length, 3);
    assert.equal(assigned[0].activityId, 'act_2');
    assert.equal(assigned[1].activityId, 'act_3');
    assert.equal(assigned[2].activityId, 'act_4');
  });

  await suite.test('3. Allocates discrete courses into separate matching timetable blocks on the same day', () => {
    const blocks = [
      {
        blockId: 'blk_web',
        label: 'Full Stack Web Development',
        category: 'webdev',
        courseSlug: 'web-development',
        startTime: '10:00',
        endTime: '11:00',
        durationMinutes: 60,
        blockType: 'learning',
      },
      {
        blockId: 'blk_type',
        label: 'Touch Typing Mastery',
        category: 'exploration',
        courseSlug: 'typing-practice',
        startTime: '16:00',
        endTime: '16:30',
        durationMinutes: 30,
        blockType: 'exploration',
      },
    ];

    const activities = [
      {
        id: 'web_1',
        courseSlug: 'web-development',
        sectionNumber: 1,
        activityNumber: 1,
        title: 'React Hooks Deep Dive',
        remainingMinutes: 60,
        totalEffortMinutes: 60,
        status: 'pending',
      },
      {
        id: 'type_1',
        courseSlug: 'typing-practice',
        sectionNumber: 1,
        activityNumber: 1,
        title: 'Speed Drill 1',
        remainingMinutes: 30,
        totalEffortMinutes: 30,
        status: 'pending',
      },
    ];

    const result = PlannerEngine.allocateCurriculumToBlocks({ blocks, activities });
    assert.equal(result.blockAllocations[0].assignedActivities[0].activityId, 'web_1');
    assert.equal(result.blockAllocations[1].assignedActivities[0].activityId, 'type_1');
  });

  await suite.test('4. Date-aware timeline distribution spreads activities across start and end dates', async () => {
    const activities = Array.from({ length: 10 }, (_, i) => ({
      id: `act_${i + 1}`,
      courseSlug: 'web-development',
      sectionNumber: 1,
      activityNumber: i + 1,
      title: `Lecture ${i + 1}`,
      remainingMinutes: 60,
      totalEffortMinutes: 60,
      status: 'pending',
    }));

    const result = await PlannerEngine.distributeCourseTimeline({
      courseSlug: 'web-development',
      startDate: '2026-12-01',
      targetDate: '2026-12-10',
      dedicatedMinutesPerDay: 60,
      activities,
    });

    assert.equal(result.startDate, '2026-12-01');
    assert.equal(result.targetDate, '2026-12-10');
    assert.equal(result.allocations.length, 10);
    // Allocations are distributed across days
    assert.equal(result.allocations[0].scheduledDate, '2026-12-01');
    assert.equal(result.allocations[9].scheduledDate, '2026-12-10');
  });
});
