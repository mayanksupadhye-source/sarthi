/**
 * SARTHI — Academic Attendance & Risk Engine
 * 
 * Transparent, deterministic calculations for theory & practical attendance.
 * No hardcoded policies; uses configurable institutional & target thresholds.
 */

export class AttendanceEngine {
  /**
   * Calculate current percentage.
   */
  static calculatePercentage(attended, total) {
    if (!total || total <= 0) return 100;
    return Math.round(((attended || 0) / total) * 100 * 10) / 10;
  }

  /**
   * Calculate classes required to reach target OR classes that can be safely missed.
   * 
   * @param {number} attended - Number of attended sessions
   * @param {number} total - Total sessions held so far
   * @param {number} targetPercent - Desired target percentage (e.g. 75 or 80)
   * @returns {Object} { currentPercent, targetPercent, status, classesNeededToTarget, safeBunksAllowed }
   */
  static calculateAttendanceStatus(attended, total, targetPercent = 75) {
    const currentPercent = AttendanceEngine.calculatePercentage(attended, total);

    if (total === 0) {
      return {
        attended: 0,
        total: 0,
        currentPercent: 100,
        targetPercent,
        status: 'on_track',
        classesNeededToTarget: 0,
        safeBunksAllowed: 0,
        summary: 'No classes conducted yet'
      };
    }

    const P = targetPercent;
    const A = attended;
    const T = total;

    if (currentPercent < P) {
      // Need more classes without missing:
      // (A + C) / (T + C) >= P / 100
      // 100*A + 100*C >= P*T + P*C
      // (100 - P)*C >= P*T - 100*A
      // C >= (P*T - 100*A) / (100 - P)
      const denominator = 100 - P;
      const numerator = (P * T) - (100 * A);
      const needed = denominator > 0 ? Math.ceil(numerator / denominator) : 0;
      
      const isCritical = currentPercent < (P - 10);

      return {
        attended: A,
        total: T,
        currentPercent,
        targetPercent: P,
        status: isCritical ? 'critical_shortage' : 'shortage',
        classesNeededToTarget: Math.max(0, needed),
        safeBunksAllowed: 0,
        summary: `Attendance is ${currentPercent}%. Attend the next ${needed} consecutive class(es) to reach ${P}%.`
      };
    } else {
      // Can safely miss without dropping below P%:
      // A / (T + S) >= P / 100
      // 100*A >= P*T + P*S
      // P*S <= 100*A - P*T
      // S <= (100*A - P*T) / P
      const safe = P > 0 ? Math.floor(((100 * A) - (P * T)) / P) : 0;

      return {
        attended: A,
        total: T,
        currentPercent,
        targetPercent: P,
        status: 'on_track',
        classesNeededToTarget: 0,
        safeBunksAllowed: Math.max(0, safe),
        summary: `Attendance is ${currentPercent}%. You can safely miss ${safe} class(es) while staying above ${P}%.`
      };
    }
  }

  /**
   * Forecast future attendance given a projection of upcoming classes.
   */
  static forecastFutureAttendance({ currentAttended, currentTotal, futureClasses, assumedAttendanceRate = 0.9 }) {
    const plannedAttended = Math.round(futureClasses * assumedAttendanceRate);
    const newTotal = currentTotal + futureClasses;
    const newAttended = currentAttended + plannedAttended;
    const projectedPercent = AttendanceEngine.calculatePercentage(newAttended, newTotal);

    return {
      futureClasses,
      assumedAttendanceRate: Math.round(assumedAttendanceRate * 100),
      projectedAttended: newAttended,
      projectedTotal: newTotal,
      projectedPercent
    };
  }
}
