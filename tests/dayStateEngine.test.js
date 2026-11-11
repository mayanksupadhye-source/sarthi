import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolateTokens } from '../server/services/copyEngine.js';

test('SARTHI Day State & Copy Engine Mechanics', async (t) => {
  await t.test('1. Interpolate dynamic arithmetic tokens into template strings without inventing data', () => {
    const template = 'Block started {minutesLate} min ago. {minutesLeft} min are still yours.';
    const tokens = { minutesLate: 8, minutesLeft: 52 };
    const result = interpolateTokens(template, tokens);
    assert.equal(result, 'Block started 8 min ago. 52 min are still yours.');
  });

  await t.test('2. Missing tokens are left untouched or safely preserved', () => {
    const template = 'Focus on {taskTitle} for {duration} min.';
    const result = interpolateTokens(template, { taskTitle: 'DSA Array Problems' });
    assert.equal(result, 'Focus on DSA Array Problems for {duration} min.');
  });

  await t.test('3. Return Protocol calculation matches real planner arithmetic', () => {
    const template = 'Real backlog: {backlogMinutes} min of essential work. That is smaller than it feels.';
    const result = interpolateTokens(template, { backlogMinutes: 45 });
    assert.equal(result, 'Real backlog: 45 min of essential work. That is smaller than it feels.');
  });
});
