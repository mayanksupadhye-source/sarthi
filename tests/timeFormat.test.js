import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatTime12, formatTimeRange, getTodayString } from '../server/utils/timeFormat.js';

describe('SARTHI Time Formatting Engine — 12-Hour Conversion', () => {
  it('1. Correctly formats Midnight as 12:00 AM', () => {
    assert.strictEqual(formatTime12('00:00'), '12:00 AM');
    assert.strictEqual(formatTime12('0:00'), '12:00 AM');
    assert.strictEqual(formatTime12('00:15'), '12:15 AM');
  });

  it('2. Correctly formats Noon as 12:00 PM', () => {
    assert.strictEqual(formatTime12('12:00'), '12:00 PM');
    assert.strictEqual(formatTime12('12:30'), '12:30 PM');
    assert.strictEqual(formatTime12('12:05'), '12:05 PM');
  });

  it('3. Formats morning, afternoon, evening, and night times with uppercase AM/PM', () => {
    assert.strictEqual(formatTime12('05:00'), '5:00 AM');
    assert.strictEqual(formatTime12('07:30'), '7:30 AM');
    assert.strictEqual(formatTime12('09:05'), '9:05 AM');
    assert.strictEqual(formatTime12('11:59'), '11:59 AM');
    assert.strictEqual(formatTime12('14:30'), '2:30 PM');
    assert.strictEqual(formatTime12('17:00'), '5:00 PM');
    assert.strictEqual(formatTime12('18:30'), '6:30 PM');
    assert.strictEqual(formatTime12('20:30'), '8:30 PM');
    assert.strictEqual(formatTime12('22:30'), '10:30 PM');
    assert.strictEqual(formatTime12('23:40'), '11:40 PM');
  });

  it('4. Preserves and normalizes already formatted 12-hour strings to uppercase AM/PM', () => {
    assert.strictEqual(formatTime12('2:30 pm'), '2:30 PM');
    assert.strictEqual(formatTime12('10:15 am'), '10:15 AM');
    assert.strictEqual(formatTime12('12:00 PM'), '12:00 PM');
  });

  it('5. Correctly formats clean time ranges with en-dash, including midnight crossovers', () => {
    assert.strictEqual(formatTimeRange('05:00', '07:30'), '5:00 AM – 7:30 AM');
    assert.strictEqual(formatTimeRange('14:30', '16:00'), '2:30 PM – 4:00 PM');
    assert.strictEqual(formatTimeRange('17:00', '18:30'), '5:00 PM – 6:30 PM');
    assert.strictEqual(formatTimeRange('23:40', '05:00'), '11:40 PM – 5:00 AM');
  });

  it('6. Handles missing or empty inputs gracefully without throwing', () => {
    assert.strictEqual(formatTime12(''), '');
    assert.strictEqual(formatTime12(null), '');
    assert.strictEqual(formatTime12(undefined), '');
    assert.strictEqual(formatTimeRange('', ''), '');
  });

  it('7. Converts ISO Date objects using target timezone', () => {
    // 2026-11-11T14:30:00Z in UTC is 8:00 PM IST (UTC+5:30)
    const testDate = new Date('2026-11-11T14:30:00Z');
    const istTime = formatTime12(testDate, 'Asia/Kolkata');
    assert.strictEqual(istTime, '8:00 PM');
  });

  it('8. getTodayString returns a valid YYYY-MM-DD string for configured timezone', () => {
    const todayStr = getTodayString('Asia/Kolkata');
    assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);
  });
});
