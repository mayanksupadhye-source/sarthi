export const JOURNAL_TEXT_LIMIT = 30000;
export const DEFAULT_JOURNAL_PAGE_SIZE = 20;
export const MAX_JOURNAL_PAGE_SIZE = 50;

export function isValidJournalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateJournalContent(content) {
  if (typeof content !== 'string' || !content.trim()) return 'Write a few words before saving your journal.';
  if (content.length > JOURNAL_TEXT_LIMIT) return `Journal entries must be ${JOURNAL_TEXT_LIMIT.toLocaleString()} characters or fewer.`;
  return null;
}

export function journalPageParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_JOURNAL_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_JOURNAL_PAGE_SIZE));
  return { page, limit, offset: (page - 1) * limit };
}
