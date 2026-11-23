const DAY_MS = 24 * 60 * 60 * 1000;

export function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localDayKey(value, timeZone = 'Asia/Kolkata') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function getExecutionChallengeProgress(tasks, today = localDayKey(new Date())) {
  const firstDay = shiftDateKey(today, -13);
  const plannedByDate = new Map();
  const completedByDate = new Map();
  const completedOnPlanDate = new Map();

  for (const task of tasks || []) {
    const id = String(task._id || task.id || `${task.scheduledDate}:${task.title}`);
    const scheduledDate = task.scheduledDate;
    if (scheduledDate >= firstDay && scheduledDate <= today && task.status !== 'cancelled') {
      if (!plannedByDate.has(scheduledDate)) plannedByDate.set(scheduledDate, new Set());
      plannedByDate.get(scheduledDate).add(id);
    }
    if (task.status !== 'completed' || !task.completedAt) continue;
    const completedDate = localDayKey(task.completedAt);
    if (completedDate < firstDay || completedDate > today) continue;
    if (!completedByDate.has(completedDate)) completedByDate.set(completedDate, new Set());
    completedByDate.get(completedDate).add(id);
    if (scheduledDate === completedDate) {
      if (!completedOnPlanDate.has(completedDate)) completedOnPlanDate.set(completedDate, new Set());
      completedOnPlanDate.get(completedDate).add(id);
    }
  }

  let executionStreakDays = 0;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = shiftDateKey(today, -offset);
    if (!completedByDate.get(date)?.size) break;
    executionStreakDays += 1;
  }

  let highCompletionDays = 0;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = shiftDateKey(today, -offset);
    const planned = plannedByDate.get(date)?.size || 0;
    const completed = completedOnPlanDate.get(date)?.size || 0;
    if (planned > 0 && completed / planned >= 0.85) highCompletionDays += 1;
  }

  return {
    firstDay,
    today,
    executionStreakDays,
    requiredStreakDays: 14,
    highCompletionDays,
    requiredHighCompletionDays: 5,
    thresholdPercent: 85,
    unlocked: executionStreakDays >= 14 && highCompletionDays >= 5
  };
}

export function dateRangeForExecution(today = localDayKey(new Date())) {
  const firstDay = shiftDateKey(today, -13);
  const start = new Date(`${firstDay}T00:00:00.000+05:30`);
  const end = new Date(`${shiftDateKey(today, 1)}T00:00:00.000+05:30`);
  return { firstDay, start, end };
}
