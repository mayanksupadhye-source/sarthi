/**
 * SARTHI — Utility Helpers
 */

export function formatMinutes(mins) {
  const m = Number(mins) || 0;
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function formatTodayDate() {
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' };
  return new Intl.DateTimeFormat('en-IN', options).format(new Date());
}

export function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function getPriorityBadge(priority) {
  switch (priority) {
    case 'P1': return '<span class="badge badge-p1">P1 Essential</span>';
    case 'P2': return '<span class="badge badge-p2">P2 Important</span>';
    case 'P3': return '<span class="badge badge-p3">P3 Optional</span>';
    default: return `<span class="badge badge-p2">${priority}</span>`;
  }
}
