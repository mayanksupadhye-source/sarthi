import test from 'node:test';
import assert from 'node:assert/strict';
import { FITNESS_QUOTES, getWeeklyFitnessQuote } from '../server/services/fitnessQuotes.js';
import { getExecutionChallengeProgress, shiftDateKey } from '../server/services/executionRewardProgress.js';

function challengeTasks(today, missingDate = null) {
  const tasks = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = shiftDateKey(today, -offset);
    if (date === missingDate) continue;
    const count = offset < 5 ? 20 : 7;
    const completeCount = offset < 5 ? 17 : 5;
    for (let index = 0; index < count; index += 1) {
      tasks.push({
        _id: `${date}-${index}`,
        scheduledDate: date,
        status: index < completeCount ? 'completed' : 'pending',
        completedAt: index < completeCount ? `${date}T12:00:00.000Z` : null
      });
    }
  }
  return tasks;
}

test('fitness quote collection has 65 original lines and remains stable throughout an ISO week', () => {
  assert.equal(FITNESS_QUOTES.length, 65);
  const friday = getWeeklyFitnessQuote(new Date('2026-11-13T12:00:00.000Z'));
  const sunday = getWeeklyFitnessQuote(new Date('2026-11-15T12:00:00.000Z'));
  const mondayInIndia = getWeeklyFitnessQuote(new Date('2026-11-15T18:30:00.000Z'));
  const monday = getWeeklyFitnessQuote(new Date('2026-11-16T12:00:00.000Z'));
  assert.deepEqual(friday, sunday);
  assert.equal(mondayInIndia.weekKey, monday.weekKey);
  assert.notEqual(sunday.weekKey, monday.weekKey);
  assert.equal(friday.author, 'SARTHI original');
});

test('execution challenge counts distinct completed tasks by actual calendar day and applies the 85% five-day rule', () => {
  const today = '2026-11-13';
  const tasks = challengeTasks(today);
  tasks.push(tasks[0]); // Duplicate activity must not multiply completion days.
  const result = getExecutionChallengeProgress(tasks, today);
  assert.equal(result.executionStreakDays, 14);
  assert.equal(result.highCompletionDays, 5);
  assert.equal(result.unlocked, true);
  assert.equal(getExecutionChallengeProgress(challengeTasks(today, '2026-11-07'), today).unlocked, false);
});
