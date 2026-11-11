/**
 * SARTHI — Utility Helpers
 */

/**
 * Formats duration in minutes to human readable string (e.g., 45m, 2h 30m)
 */
export function formatMinutes(mins) {
  const m = Number(mins) || 0;
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

/**
 * Returns formatted Indian date string (e.g., "Wed, Nov 11, 2026")
 */
export function formatTodayDate() {
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' };
  return new Intl.DateTimeFormat('en-IN', options).format(new Date());
}

/**
 * Returns ISO date string for today (YYYY-MM-DD)
 */
export function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Converts 24-hour time string ("14:30", "05:00", "00:00", "12:00") or Date
 * into standard 12-hour format with uppercase AM or PM ("2:30 PM", "12:00 AM", "12:00 PM").
 * 
 * Midnight (00:00) -> 12:00 AM
 * Noon (12:00)     -> 12:00 PM
 * 
 * @param {string|Date} timeVal 
 * @returns {string} e.g. "2:30 PM", "5:00 AM"
 */
export function formatTime12(timeVal) {
  if (timeVal === null || timeVal === undefined || timeVal === '') return '';

  if (typeof timeVal === 'string') {
    const trimmed = timeVal.trim();
    // Normalize existing 12-hour string (e.g. "2:30 pm" -> "2:30 PM")
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
    if (match12) {
      const h = parseInt(match12[1], 10);
      const m = match12[2];
      const p = match12[3].toUpperCase();
      return `${h}:${m} ${p}`;
    }

    // Convert 24-hour time string "HH:mm" or "HH:mm:ss" or "H:mm"
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
      let hours = parseInt(match24[1], 10);
      const minutes = match24[2];
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${period}`;
    }
  }

  // Convert Date object or ISO timestamp string
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
 */
export function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return '';
  if (!endTime) return formatTime12(startTime);
  if (!startTime) return formatTime12(endTime);
  return `${formatTime12(startTime)} – ${formatTime12(endTime)}`;
}

/**
 * Returns HTML badge element for priority levels
 */
export function getPriorityBadge(priority) {
  switch (priority) {
    case 'P1': return '<span class="badge badge-p1">P1 Essential</span>';
    case 'P2': return '<span class="badge badge-p2">P2 Core</span>';
    case 'P3': return '<span class="badge badge-p3">P3 Optional</span>';
    default: return `<span class="badge badge-p2">${priority}</span>`;
  }
}
