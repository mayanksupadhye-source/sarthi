import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, calculateCycleIntelligence, dateInTimezone, differenceInDays,
  estimateCycleLength, getCalendarDay, getPhaseRanges, isDateOnly
} from '../server/services/cycleEngine.js';

test('date-only parsing and arithmetic avoid local timezone shifts', () => {
  assert.equal(isDateOnly('2026-10-23'), true);
  assert.equal(isDateOnly('2026-02-29'), false);
  assert.equal(isDateOnly('2028-02-29'), true);
  assert.equal(addDays('2026-10-23', 28), '2026-11-20');
  assert.equal(differenceInDays('2026-10-23', '2026-11-19'), 27);
  assert.equal(dateInTimezone('Asia/Kolkata', new Date('2026-11-11T20:00:00.000Z')), '2026-11-12');
});

test('initial 28-day estimate predicts from the actual October baseline', () => {
  const records = [{ _id: 'baseline', actualPeriodStartDate: '2026-10-23' }];
  const result = calculateCycleIntelligence({ records, cycleLengthPreference: 28, periodLength: 5, asOfDate: '2026-11-12' });
  assert.equal(result.cycleLength, 28);
  assert.equal(result.currentCycle.cycleDay, 21);
  assert.equal(result.currentCycle.currentPhase.key, 'luteal');
  assert.equal(result.prediction.predictedNextPeriodStart, '2026-11-20');
});

test('actual intervals adapt the rolling median and move later predictions', () => {
  const records = [
    { _id: 'a', actualPeriodStartDate: '2026-10-23' },
    { _id: 'b', actualPeriodStartDate: '2026-11-19' },
    { _id: 'c', actualPeriodStartDate: '2026-12-17' }
  ];
  assert.equal(estimateCycleLength(records), 28);
  const result = calculateCycleIntelligence({ records, cycleLengthPreference: 28, periodLength: 5, asOfDate: '2026-12-20' });
  assert.equal(result.cycleLength, 28);
  assert.equal(result.prediction.predictedNextPeriodStart, '2027-01-14');
  assert.equal(result.prediction.basedOnPeriodRecordId, 'c');
});

test('phase ranges cover each cycle day exactly once for supported extremes', () => {
  for (const [cycleLength, periodLength] of [[21, 1], [21, 10], [28, 5], [60, 10]]) {
    const ranges = getPhaseRanges(cycleLength, periodLength);
    for (let day = 1; day <= cycleLength; day += 1) {
      const matches = ranges.filter(phase => day >= phase.startDay && day <= phase.endDay);
      assert.equal(matches.length, 1, `cycle ${cycleLength}, period ${periodLength}, day ${day}`);
    }
  }
});

test('calendar distinguishes a confirmed period start and an estimate', () => {
  const records = [{ actualPeriodStartDate: '2026-10-23', actualPeriodEndDate: '2026-10-27' }];
  const common = { latestActualStart: '2026-10-23', cycleLength: 28, periodLength: 5, records, predictedStarts: ['2026-11-20'] };
  assert.equal(getCalendarDay({ ...common, date: '2026-10-23' }).actualPeriodStart, true);
  assert.equal(getCalendarDay({ ...common, date: '2026-10-25' }).actualPeriod, true);
  assert.equal(getCalendarDay({ ...common, date: '2026-11-20' }).predictedPeriod, true);
});

test('historical calendar phases follow the actual interval for that recorded cycle', () => {
  const records = [
    { actualPeriodStartDate: '2026-10-23' },
    { actualPeriodStartDate: '2026-11-19' },
    { actualPeriodStartDate: '2026-12-23' }
  ];
  const day = getCalendarDay({
    date: '2026-12-05', latestActualStart: '2026-12-23', cycleLength: 31,
    periodLength: 5, records, predictedStarts: []
  });
  assert.equal(day.cycleDay, 17);
  assert.equal(day.phase, 'follicular');
});
