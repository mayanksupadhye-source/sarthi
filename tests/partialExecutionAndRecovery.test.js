import test from 'node:test';
import assert from 'node:assert/strict';

test('Partial Execution — Cumulative Work Preservation', async (t) => {
  await t.test('1. Partial work updates actualMinutes and reduces remainingMinutes monotonically', () => {
    const task = {
      title: 'Chai aur Code React Redux Toolkit',
      estimatedMinutes: 90,
      actualMinutes: 0,
      remainingMinutes: 90,
      status: 'pending'
    };

    // First session: Log 25 minutes of focused work
    const session1Minutes = 25;
    task.actualMinutes += session1Minutes;
    task.remainingMinutes = Math.max(0, task.estimatedMinutes - task.actualMinutes);
    task.status = task.remainingMinutes === 0 ? 'completed' : 'in-progress';

    assert.equal(task.actualMinutes, 25);
    assert.equal(task.remainingMinutes, 65);
    assert.equal(task.status, 'in-progress');

    // Second session: Log 35 minutes
    const session2Minutes = 35;
    task.actualMinutes += session2Minutes;
    task.remainingMinutes = Math.max(0, task.estimatedMinutes - task.actualMinutes);
    task.status = task.remainingMinutes === 0 ? 'completed' : 'in-progress';

    assert.equal(task.actualMinutes, 60);
    assert.equal(task.remainingMinutes, 30);
    assert.equal(task.status, 'in-progress');

    // Third session: Finish remaining 30 minutes
    const session3Minutes = 30;
    task.actualMinutes += session3Minutes;
    task.remainingMinutes = Math.max(0, task.estimatedMinutes - task.actualMinutes);
    task.status = task.remainingMinutes === 0 ? 'completed' : 'in-progress';

    assert.equal(task.actualMinutes, 90);
    assert.equal(task.remainingMinutes, 0);
    assert.equal(task.status, 'completed');
  });

  await t.test('2. Over-execution clamps remainingMinutes to 0 without throwing error', () => {
    const task = {
      estimatedMinutes: 45,
      actualMinutes: 0,
      remainingMinutes: 45
    };

    // Spent 60 minutes debugging difficult edge cases on a 45m estimate
    const sessionMinutes = 60;
    task.actualMinutes += sessionMinutes;
    task.remainingMinutes = Math.max(0, task.estimatedMinutes - task.actualMinutes);

    assert.equal(task.actualMinutes, 60);
    assert.equal(task.remainingMinutes, 0);
  });
});

test('Adaptive Recovery Ledger — Deficit Tracking & FIFO Deduction', async (t) => {
  await t.test('1. Missed work creates tracked deficit without doubling tomorrow load', () => {
    const ledger = {
      entries: [],
      recordMissed(courseSlug, missedMinutes, reason) {
        this.entries.push({
          id: `rec-${this.entries.length + 1}`,
          courseSlug,
          originalMissedMinutes: missedMinutes,
          recoveredMinutes: 0,
          remainingRecoveryMinutes: missedMinutes,
          status: 'active',
          reason
        });
      },
      getTotalBalance() {
        return this.entries
          .filter(e => e.status === 'active')
          .reduce((sum, e) => sum + e.remainingRecoveryMinutes, 0);
      }
    };

    // User missed a 60m WebDev block on Monday
    ledger.recordMissed('webdev', 60, 'Missed due to college lab extension');
    assert.equal(ledger.getTotalBalance(), 60);

    // User missed a 45m DSA block on Tuesday
    ledger.recordMissed('dsa', 45, 'Commute delay');
    assert.equal(ledger.getTotalBalance(), 105);
    assert.equal(ledger.entries.length, 2);
  });

  await t.test('2. Recovers deficits in FIFO order across multiple ledger records', () => {
    const entries = [
      { id: 'rec-1', originalMissedMinutes: 40, recoveredMinutes: 0, remainingRecoveryMinutes: 40, status: 'active' },
      { id: 'rec-2', originalMissedMinutes: 50, recoveredMinutes: 0, remainingRecoveryMinutes: 50, status: 'active' }
    ];

    function deductRecovery(recoveryMinutes) {
      let needed = recoveryMinutes;
      for (const entry of entries) {
        if (needed <= 0) break;
        if (entry.status !== 'active') continue;

        const alloc = Math.min(needed, entry.remainingRecoveryMinutes);
        entry.recoveredMinutes += alloc;
        entry.remainingRecoveryMinutes -= alloc;
        needed -= alloc;

        if (entry.remainingRecoveryMinutes === 0) {
          entry.status = 'recovered';
        }
      }
    }

    // Step 1: User does a 30m recovery session
    deductRecovery(30);
    assert.equal(entries[0].remainingRecoveryMinutes, 10);
    assert.equal(entries[0].status, 'active');
    assert.equal(entries[1].remainingRecoveryMinutes, 50);

    // Step 2: User does a 25m recovery session (should clear remaining 10m of rec-1 and 15m of rec-2)
    deductRecovery(25);
    assert.equal(entries[0].remainingRecoveryMinutes, 0);
    assert.equal(entries[0].status, 'recovered');
    assert.equal(entries[1].remainingRecoveryMinutes, 35);
    assert.equal(entries[1].status, 'active');

    // Total remaining deficit: 35 minutes
    const totalRemaining = entries.reduce((sum, e) => sum + e.remainingRecoveryMinutes, 0);
    assert.equal(totalRemaining, 35);
  });
});
