/**
 * SARTHI — Time Formatting Engine
 * Converts 24-hour time strings or Date objects into standard 12-hour format
 * with uppercase AM or PM (e.g., "2:30 PM", "12:00 AM", "12:00 PM").
 */

/**
 * Converts any time value (e.g. "14:30", "05:00", "00:00", "12:00", or Date)
 * to 12-hour format with uppercase AM or PM.
 * 
 * Midnight (00:00) -> 12:00 AM
 * Noon (12:00)     -> 12:00 PM
 * 
 * @param {string|Date} timeVal 
 * @returns {string} 12-hour formatted time string, e.g. "2:30 PM"
 */
export function formatTime12(timeVal) {
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
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${period}`;
  }

  return String(timeVal);
}

/**
 * Formats a start and end time pair into a clean 12-hour range string.
 * Example: ("14:30", "16:00") -> "2:30 PM – 4:00 PM"
 * 
 * @param {string|Date} startTime 
 * @param {string|Date} endTime 
 * @returns {string} e.g. "5:00 AM – 7:30 AM"
 */
export function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return '';
  if (!endTime) return formatTime12(startTime);
  if (!startTime) return formatTime12(endTime);
  return `${formatTime12(startTime)} – ${formatTime12(endTime)}`;
}
