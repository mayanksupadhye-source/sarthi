const DAY_MS = 24 * 60 * 60 * 1000;
export const FOCUS_HISTORY_DEFAULT_LIMIT = 20;
export const FOCUS_HISTORY_MAX_LIMIT = 50;
export const FOCUS_HISTORY_PERIODS = ['7d', '30d', 'year', 'older'];

export function getFocusHistoryFilter(userId, period, now = new Date()) {
  if (!FOCUS_HISTORY_PERIODS.includes(period)) {
    throw new RangeError(`Unsupported focus history period: ${period}`);
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  return {
    userId,
    status: 'completed',
    endTime: period === 'older' ? { $lt: cutoff } : { $gte: cutoff, $lte: now }
  };
}

export function normalizeFocusHistoryPagination(query = {}) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const requestedLimit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : FOCUS_HISTORY_DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, FOCUS_HISTORY_MAX_LIMIT);
  return { page, limit };
}

export function validateFocusReflection(value) {
  if (value === undefined || value === null) return { valid: true, value: '' };
  if (typeof value !== 'string') return { valid: false, error: 'Reflection must be text.' };
  if (value.length > 100) return { valid: false, error: 'Reflection must be 100 characters or fewer.' };
  return { valid: true, value: value.trim() };
}
