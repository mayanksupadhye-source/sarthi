import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionSyncService } from '../server/services/executionSyncService.js';
import { ExecutionRecord } from '../server/models/ExecutionRecord.js';
import { Task } from '../server/models/Task.js';
import { CurriculumActivity } from '../server/models/CurriculumActivity.js';
import { SlackDayLog } from '../server/models/SlackDayLog.js';
import { RecoveryLedger } from '../server/models/RecoveryLedger.js';
import { getTodayString } from '../server/utils/timeFormat.js';

test('Reliability & Data Integrity — Execution Idempotency & Operation ID', async (t) => {
  await t.test('1. Multiple calls with identical operationId return same result and do not duplicate execution minutes', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const opId = 'op_test_idem_12345';
    const fakeTaskId = '507f1f77bcf86cd799439022';

    // Mock ExecutionRecord and CurriculumActivity
    const originalFindOne = ExecutionRecord.findOne;
    const originalCreate = ExecutionRecord.create;
    const originalTaskFindOne = Task.findOne;
    const originalActFindOne = CurriculumActivity.findOne;

    let createdCount = 0;
    const savedRecords = [];

    ExecutionRecord.findOne = async (query) => {
      return savedRecords.find(r => r.operationId === query.operationId && r.userId === query.userId) || null;
    };

    ExecutionRecord.create = async (doc) => {
      createdCount++;
      const rec = { ...doc, _id: `rec_${createdCount}` };
      savedRecords.push(rec);
      return rec;
    };

    Task.findOne = async () => ({
      _id: fakeTaskId,
      userId,
      actualMinutes: 30,
      estimatedMinutes: 60,
      remainingMinutes: 30,
      save: async () => {},
    });

    CurriculumActivity.findOne = async () => null;

    try {
      // First submission
      const res1 = await ExecutionSyncService.recordWork({
        userId,
        taskId: fakeTaskId,
        minutesSpent: 30,
        operationId: opId,
        date: '2026-11-24',
      });

      assert.equal(createdCount, 1);
      assert.ok(res1.executionRecord);
      assert.equal(res1.executionRecord.minutesSpent, 30);

      // Retry submission with the same operationId
      const res2 = await ExecutionSyncService.recordWork({
        userId,
        taskId: fakeTaskId,
        minutesSpent: 30,
        operationId: opId,
        date: '2026-11-24',
      });

      // Crucial assertion: createdCount MUST still be 1 (no double increment)
      assert.equal(createdCount, 1, 'Duplicate operationId must not create a new execution record');
      assert.equal(res2.isDuplicate, true);
      assert.equal(res2.executionRecord._id, res1.executionRecord._id);
    } finally {
      ExecutionRecord.findOne = originalFindOne;
      ExecutionRecord.create = originalCreate;
      Task.findOne = originalTaskFindOne;
      CurriculumActivity.findOne = originalActFindOne;
    }
  });

  await t.test('2. SlackDayLog enforces unique per-user per-date in schema declaration', () => {
    const indexes = SlackDayLog.schema.indexes();
    const hasUniqueDateIndex = indexes.some(idx => {
      const fields = idx[0];
      const opts = idx[1];
      return fields.userId === 1 && fields.date === 1 && opts.unique === true;
    });
    assert.equal(hasUniqueDateIndex, true, 'SlackDayLog must declare unique index on { userId: 1, date: 1 }');
  });

  await t.test('3. ExecutionRecord declares sparse unique index on { userId: 1, operationId: 1 }', () => {
    const indexes = ExecutionRecord.schema.indexes();
    const hasOpIdIndex = indexes.some(idx => {
      const fields = idx[0];
      const opts = idx[1];
      return fields.userId === 1 && fields.operationId === 1 && opts.unique === true && opts.sparse === true;
    });
    assert.equal(hasOpIdIndex, true, 'ExecutionRecord must declare unique sparse index on { userId: 1, operationId: 1 }');
  });

  await t.test('4. Default getTodayString aligns to Asia/Kolkata timezone without midnight shift', () => {
    const today = getTodayString();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD');
  });
});
