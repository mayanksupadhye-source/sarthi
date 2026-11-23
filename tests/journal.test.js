import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JournalEntry } from '../server/models/JournalEntry.js';
import { isValidJournalDate, journalPageParams, validateJournalContent } from '../server/services/journalRules.js';
import { DAILY_REFLECTION_PROMPT } from '../client/assets/js/journalPrompt.js';

test('journal date and text validation reject invalid input while preserving written text', () => {
  assert.equal(isValidJournalDate('2026-11-13'), true);
  assert.equal(isValidJournalDate('2026-02-30'), false);
  assert.equal(isValidJournalDate('13/11/2026'), false);
  assert.match(validateJournalContent('   '), /Write a few words/);
  assert.match(validateJournalContent('a'.repeat(30001)), /30,000/);
  assert.equal(validateJournalContent('  Keep my spacing.  '), null);
});

test('journal pagination uses a bounded page size and returns stable offsets', () => {
  assert.deepEqual(journalPageParams({}), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(journalPageParams({ page: '3', limit: '1000' }), { page: 3, limit: 50, offset: 100 });
  assert.deepEqual(journalPageParams({ page: '-4', limit: '0' }), { page: 1, limit: 20, offset: 0 });
});

test('journal schema scopes records to users and indexes date lookup and idempotency', () => {
  assert.equal(JournalEntry.schema.path('userId').isRequired, true);
  assert.equal(JournalEntry.schema.path('journalDate').isRequired, true);
  assert.equal(JournalEntry.schema.path('content').options.maxlength, 30000);
  const indexes = JournalEntry.schema.indexes();
  assert.ok(indexes.some(([keys]) => keys.userId === 1 && keys.dateKey === -1 && keys.createdAt === -1));
  assert.ok(indexes.some(([keys, options]) => keys.userId === 1 && keys.submissionKey === 1 && options.unique));
});

test('reflection prompt is complete and stays out of visible journal markup', async () => {
  assert.ok(DAILY_REFLECTION_PROMPT.length > 7000);
  assert.match(DAILY_REFLECTION_PROMPT, /PART 1 — ENGLISH & COMMUNICATION FEEDBACK/);
  assert.match(DAILY_REFLECTION_PROMPT, /PART 2 — HUMAN REFLECTION/);
  assert.match(DAILY_REFLECTION_PROMPT, /PART 3 — MY DAILY IMPROVEMENT PRIORITIES/);
  assert.match(DAILY_REFLECTION_PROMPT, /Now analyse the journal I provide below\./);
  const html = await readFile(new URL('../client/pages/journal.html', import.meta.url), 'utf8');
  assert.match(html, /import \{ DAILY_REFLECTION_PROMPT \} from/);
  assert.doesNotMatch(html, /I am going to describe my day in my own words/);
  assert.doesNotMatch(html, /Your long-term objective: Help me become a better communicator/);
});
