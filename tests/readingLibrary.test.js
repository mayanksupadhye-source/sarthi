import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadingBook } from '../server/models/ReadingBook.js';
import { ReadingTrack } from '../server/models/ReadingTrack.js';
import { ReadingLog } from '../server/models/ReadingLog.js';
import { READING_ROADMAP, uniquePages, computeTrackProgression } from '../server/services/readingLibrary.js';

test('initial reading roadmap seeds 11 specified titles across six ordered phases', () => {
  assert.equal(READING_ROADMAP.length, 6);
  assert.equal(READING_ROADMAP.reduce((count, phase) => count + phase.books.filter(Boolean).length, 0), 11);
  assert.deepEqual(READING_ROADMAP.map(phase => phase.title), [
    'Foundations and Personal Discipline', 'Startup Thinking', 'Sales and Persuasion',
    'Business Execution', 'Financial Intelligence', 'Leadership'
  ]);
  assert.equal(READING_ROADMAP[0].books[0][0], 'Build Don’t Talk');
  assert.equal(READING_ROADMAP[5].books[1], null);
  assert.deepEqual(READING_ROADMAP.map(phase=>phase.books.map(book=>book&&book.slice(0,2))),[
    [['Build Don’t Talk','Raj Shamani'],['Atomic Habits','James Clear']],
    [['The Lean Startup','Eric Ries'],['Zero to One','Peter Thiel']],
    [['SPIN Selling','Neil Rackham'],['Influence: The Psychology of Persuasion','Robert Cialdini']],
    [['Rework','Jason Fried and David Heinemeier Hansson'],['The Hard Thing About Hard Things','Ben Horowitz']],
    [['The Psychology of Money','Morgan Housel'],['Rich Dad Poor Dad','Robert Kiyosaki']],
    [['Leaders Eat Last','Simon Sinek'],null]
  ]);
});

test('unique reading pages merge overlapping and adjacent page intervals', () => {
  assert.equal(uniquePages([
    { startPage: 0, endPage: 15 },
    { startPage: 10, endPage: 22 },
    { startPage: 22, endPage: 28 },
    { startPage: 35, endPage: 40 }
  ]), 33);
  assert.equal(uniquePages([]), 0);
});

test('track progression unlocks independently and never starts the next book automatically', () => {
  const trackA = computeTrackProgression(['completed', 'upcoming', 'upcoming']);
  const trackB = computeTrackProgression(['reading', 'upcoming', 'upcoming']);
  assert.deepEqual(trackA, ['completed', 'available', 'upcoming']);
  assert.deepEqual(trackB, ['reading', 'upcoming', 'upcoming']);
  assert.deepEqual(computeTrackProgression(['completed','available','upcoming']), ['completed','available','upcoming']);
});

test('reading books and tracks use database IDs and user scoped indexes', () => {
  assert.equal(ReadingBook.schema.path('phaseId').options.ref, 'ReadingPhase');
  assert.equal(ReadingBook.schema.path('trackId').options.ref, 'ReadingTrack');
  assert.ok(ReadingBook.schema.path('userId').isRequired);
  assert.ok(ReadingTrack.schema.path('userId').isRequired);
  assert.equal(ReadingLog.schema.path('bookId').options.ref, 'ReadingBook');
});
