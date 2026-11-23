import test from 'node:test';
import assert from 'node:assert/strict';
import { FocusSession } from '../server/models/FocusSession.js';
import {
  FOCUS_HISTORY_PERIODS,
  getFocusHistoryFilter,
  normalizeFocusHistoryPagination,
  validateFocusReflection
} from '../server/services/focusHistory.js';

test('focus history filters completed sessions into rolling date ranges', () => {
  const now = new Date('2026-11-13T12:00:00.000Z');
  const sevenDays = getFocusHistoryFilter('user-1', '7d', now);
  assert.equal(sevenDays.userId, 'user-1');
  assert.equal(sevenDays.status, 'completed');
  assert.equal(sevenDays.endTime.$gte.toISOString(), '2026-11-06T12:00:00.000Z');
  assert.equal(sevenDays.endTime.$lte, now);

  const older = getFocusHistoryFilter('user-1', 'older', now);
  assert.equal(older.endTime.$lt.toISOString(), '2025-11-13T12:00:00.000Z');
  assert.throws(() => getFocusHistoryFilter('user-1', 'all', now), RangeError);
  assert.deepEqual(FOCUS_HISTORY_PERIODS, ['7d', '30d', 'year', 'older']);
});

test('focus history pagination has a default and caps requested page size', () => {
  assert.deepEqual(normalizeFocusHistoryPagination({}), { page: 1, limit: 20 });
  assert.deepEqual(normalizeFocusHistoryPagination({ page: '3', limit: '1000' }), { page: 3, limit: 50 });
  assert.deepEqual(normalizeFocusHistoryPagination({ page: '-1', limit: '0' }), { page: 1, limit: 20 });
});

test('focus reflections are optional text limited to 100 characters', () => {
  assert.deepEqual(validateFocusReflection(undefined), { valid: true, value: '' });
  assert.deepEqual(validateFocusReflection('  Useful insight  '), { valid: true, value: 'Useful insight' });
  assert.equal(validateFocusReflection('x'.repeat(100)).valid, true);
  assert.equal(validateFocusReflection('x'.repeat(101)).valid, false);
  assert.equal(validateFocusReflection({}).valid, false);
});

test('focus actual duration excludes a pause that is still open at completion', () => {
  const started = new Date('2026-11-13T10:00:00.000Z');
  const paused = new Date('2026-11-13T10:10:00.000Z');
  const completed = new Date('2026-11-13T10:30:00.000Z');
  const session = new FocusSession({
    title: 'Deep work',
    targetMinutes: 25,
    startTime: started,
    endTime: completed,
    status: 'paused',
    pauses: [{ pausedAt: paused }]
  });

  assert.equal(session.calculateActualDuration(completed), 10);
});
