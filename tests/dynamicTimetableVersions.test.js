import test from 'node:test';
import assert from 'node:assert/strict';

test('Dynamic Timetable — Effective Dating & Version Resolution', async (t) => {
  const versions = [
    {
      version: 1,
      title: 'Semester 3 Weekday Schedule',
      effectiveFrom: '2026-01-01',
      studyCapacityMinutes: 300,
      blocks: [
        { label: 'DSA', startTime: '06:00', endTime: '07:30', durationMinutes: 90 },
        { label: 'College', startTime: '09:00', endTime: '16:30', durationMinutes: 450 },
        { label: 'WebDev', startTime: '18:00', endTime: '19:30', durationMinutes: 90 }
      ]
    },
    {
      version: 2,
      title: 'Semester 4 Weekday Schedule',
      effectiveFrom: '2027-01-15',
      studyCapacityMinutes: 360,
      blocks: [
        { label: 'DSA', startTime: '06:00', endTime: '08:00', durationMinutes: 120 },
        { label: 'College', startTime: '09:30', endTime: '15:30', durationMinutes: 360 },
        { label: 'WebDev', startTime: '17:00', endTime: '19:00', durationMinutes: 120 }
      ]
    }
  ];

  function resolveTemplateForDate(dateStr) {
    const candidates = versions
      .filter(v => v.effectiveFrom <= dateStr)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version);
    return candidates[0] || versions[0];
  }

  await t.test('1. Resolves Semester 3 schedule for dates before Semester 4 effectiveFrom', () => {
    const historical = resolveTemplateForDate('2026-06-15');
    assert.equal(historical.version, 1);
    assert.equal(historical.title, 'Semester 3 Weekday Schedule');
    assert.equal(historical.studyCapacityMinutes, 300);

    const dayBeforeTransition = resolveTemplateForDate('2027-01-14');
    assert.equal(dayBeforeTransition.version, 1);
  });

  await t.test('2. Resolves Semester 4 schedule on and after effective date without altering history', () => {
    const transitionDay = resolveTemplateForDate('2027-01-15');
    assert.equal(transitionDay.version, 2);
    assert.equal(transitionDay.title, 'Semester 4 Weekday Schedule');
    assert.equal(transitionDay.studyCapacityMinutes, 360);

    const futureDay = resolveTemplateForDate('2027-03-20');
    assert.equal(futureDay.version, 2);
  });
});

test('Dynamic Timetable — Single-Day Schedule Exceptions', async (t) => {
  const recurringTemplate = {
    dayType: 'weekday',
    studyCapacityMinutes: 300
  };

  const exceptions = new Map([
    ['2026-11-20', { exceptionType: 'college_holiday', templateOverride: 'holiday', extraAvailableMinutes: 180 }],
    ['2026-11-25', { exceptionType: 'family_event', templateOverride: 'weekday', extraAvailableMinutes: -120 }]
  ]);

  function getEffectiveCapacity(dateStr) {
    const exc = exceptions.get(dateStr);
    if (exc) {
      const baseCap = exc.templateOverride === 'holiday' ? 450 : recurringTemplate.studyCapacityMinutes;
      return baseCap + (exc.extraAvailableMinutes || 0);
    }
    return recurringTemplate.studyCapacityMinutes;
  }

  await t.test('1. Normal days use standard recurring capacity', () => {
    assert.equal(getEffectiveCapacity('2026-11-19'), 300);
    assert.equal(getEffectiveCapacity('2026-11-21'), 300);
  });

  await t.test('2. Holiday exception expands capacity by extra minutes for that date only', () => {
    // Holiday base (450) + 180 = 630 min
    assert.equal(getEffectiveCapacity('2026-11-20'), 630);
  });

  await t.test('3. Busy day exception supports negative deltas to reduce capacity gracefully', () => {
    // Weekday base (300) - 120 = 180 min
    assert.equal(getEffectiveCapacity('2026-11-25'), 180);
  });
});

test('Dynamic Timetable — Time Block Overlap & Sleep Window Analysis', async (t) => {
  function timeToMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function detectOverlaps(blocks) {
    const overlaps = [];
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const b1 = blocks[i];
        const b2 = blocks[j];
        const s1 = timeToMin(b1.startTime);
        const e1 = timeToMin(b1.endTime);
        const s2 = timeToMin(b2.startTime);
        const e2 = timeToMin(b2.endTime);

        if (s1 < e2 && s2 < e1) {
          overlaps.push({ b1: b1.label, b2: b2.label });
        }
      }
    }
    return overlaps;
  }

  await t.test('1. Detects overlapping study blocks', () => {
    const blocks = [
      { label: 'DSA', startTime: '18:00', endTime: '19:30' },
      { label: 'WebDev', startTime: '19:00', endTime: '20:30' }
    ];
    const overlaps = detectOverlaps(blocks);
    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0].b1, 'DSA');
    assert.equal(overlaps[0].b2, 'WebDev');
  });

  await t.test('2. Accurately calculates sleep window duration across midnight', () => {
    const sleepStart = '23:40';
    const sleepEnd = '05:00';
    const sMin = timeToMin(sleepStart);
    const eMin = timeToMin(sleepEnd);
    const duration = ((24 * 60) - sMin) + eMin;

    assert.equal(duration, 320); // 5 hours 20 minutes
    assert.equal((duration / 60).toFixed(1), '5.3');
  });
});
