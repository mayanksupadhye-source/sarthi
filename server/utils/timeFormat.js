/**
 * SARTHI — Time & Timezone Formatting Engine
 * Converts 24-hour time strings or Date objects into standard 12-hour format
 * with uppercase AM or PM (e.g., "2:30 PM", "12:00 AM", "12:00 PM").
 * 
 * SARTHI Date & Time Field Taxonomy:
 * 
 * 1. Date-Only Strings ("YYYY-MM-DD"):
 *    - Fields: Task.scheduledDate, Task.deadline, DailyPlan.date, Examination.examDate,
 *              AttendanceRecord.date, SlackDayLog.date, FitnessLog.date.
 *    - Meaning: Represents a distinct calendar day in the user's local timezone.
 *    - Rule: Never convert to UTC timestamp; avoids day shift around midnight.
 * 
 * 2. Local Wall-Clock Times ("HH:mm" machine format, rendered as "h:mm A"):
 *    - Fields: ScheduleTemplate.blocks[].startTime, ScheduleTemplate.blocks[].endTime,
 *              Examination.startTime, Setting.sleepWindowStart, Setting.sleepWindowEnd.
 *    - Meaning: The hour/minute on the student's physical wall clock in their timezone.
 *    - Rule: Preserved as "HH:mm" in API/DB. Formatted as 12-hour AM/PM at UI boundary.
 * 
 * 3. Absolute UTC Timestamps (ISO 8601 Date):
 *    - Fields: FocusSession.startTime, FocusSession.endTime, createdAt, updatedAt.
 *    - Meaning: Exact physical instant in time.
 *    - Rule: Stored as Date in MongoDB (UTC). Converted with timezone for display.
 */

/**
 * Returns today's date in YYYY-MM-DD format aligned strictly to the target timezone.
 * Eliminates midnight UTC shift where UTC is still yesterday.
 * 
 * @param {string} tz - IANA timezone (defaults to Asia/Kolkata)
 * @returns {string} e.g. "2026-11-11"
 */
export function getTodayString(tz = 'Asia/Kolkata') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Converts any time value (e.g. "14:30", "05:00", "00:00", "12:00", or Date)
 * to 12-hour format with uppercase AM or PM.
 * 
 * Midnight (00:00) -> 12:00 AM
 * Noon (12:00)     -> 12:00 PM
 * 
 * @param {string|Date} timeVal 
 * @param {string} [tz='Asia/Kolkata'] - Used when timeVal is a Date object
 * @returns {string} 12-hour formatted time string, e.g. "2:30 PM"
 */
export function formatTime12(timeVal, tz = 'Asia/Kolkata') {
  if (timeVal === null || timeVal === undefined || timeVal === '') return '';

  // Handle already formatted 12-hour string (normalize AM/PM to uppercase)
  if (typeof timeVal === 'string') {
    const trimmed = timeVal.trim();
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
    if (match12) {
      const h = parseInt(match12[1], 10);
      const m = match12[2];
      const p = match12[3].toUpperCase();
      return `${h}:${m} ${p}`;
    }

    // Handle 24-hour time string "HH:mm" or "HH:mm:ss" or "H:mm"
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
      let hours = parseInt(match24[1], 10);
      const minutes = match24[2];
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12; // 00:00 -> 12:00 AM, 12:00 -> 12:00 PM
      return `${hours}:${minutes} ${period}`;
    }
  }

  // Handle Date object or ISO timestamp string
  const d = timeVal instanceof Date ? timeVal : new Date(timeVal);
  if (!isNaN(d.getTime())) {
    try {
      // Use Intl with specific timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return formatter.format(d);
    } catch {
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${period}`;
    }
  }

  return String(timeVal);
}

/**
 * Formats a start and end time pair into a clean 12-hour range string.
 * Example: ("14:30", "16:00") -> "2:30 PM – 4:00 PM"
 * 
 * @param {string|Date} startTime 
 * @param {string|Date} endTime 
 * @param {string} [tz='Asia/Kolkata']
 * @returns {string} e.g. "5:00 AM – 7:30 AM"
 */
export function formatTimeRange(startTime, endTime, tz = 'Asia/Kolkata') {
  if (!startTime && !endTime) return '';
  if (!endTime) return formatTime12(startTime, tz);
  if (!startTime) return formatTime12(endTime, tz);
  return `${formatTime12(startTime, tz)} – ${formatTime12(endTime, tz)}`;
}
