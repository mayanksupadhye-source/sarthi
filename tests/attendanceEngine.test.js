import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AttendanceEngine } from '../server/services/attendanceEngine.js';

describe('SARTHI Academic Attendance Engine', () => {

  it('1. Calculates safe bunks when attendance is comfortably above target', () => {
    // 32 attended out of 35 total = 91.4%
    // Target is 75%
    // S = (3200 - 75*35) / 75 = (3200 - 2625) / 75 = 575 / 75 = 7.66 -> 7 safe bunks
    const res = AttendanceEngine.calculateAttendanceStatus(32, 35, 75);
    assert.equal(res.status, 'on_track');
    assert.equal(res.safeBunksAllowed, 7);
    assert.equal(res.classesNeededToTarget, 0);
  });

  it('2. Calculates consecutive classes needed when below target', () => {
    // 15 attended out of 25 total = 60%
    // Target is 75%
    // Needed = (75*25 - 1500) / (100 - 75) = (1875 - 1500) / 25 = 375 / 25 = 15 classes
    const res = AttendanceEngine.calculateAttendanceStatus(15, 25, 75);
    assert.equal(res.status, 'critical_shortage');
    assert.equal(res.classesNeededToTarget, 15);
    assert.equal(res.safeBunksAllowed, 0);
  });

  it('3. Forecasts future attendance based on planned schedule', () => {
    const forecast = AttendanceEngine.forecastFutureAttendance({
      currentAttended: 15,
      currentTotal: 25,
      futureClasses: 20,
      assumedAttendanceRate: 1.0 // 100% of upcoming classes
    });

    // 15 + 20 = 35 attended out of 45 = 77.8%
    assert.equal(forecast.projectedTotal, 45);
    assert.equal(forecast.projectedAttended, 35);
    assert.equal(forecast.projectedPercent, 77.8);
  });

});
