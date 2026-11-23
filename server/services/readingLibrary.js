import { ReadingPhase } from '../models/ReadingPhase.js';
import { ReadingTrack } from '../models/ReadingTrack.js';
import { ReadingBook } from '../models/ReadingBook.js';
import { ReadingLog } from '../models/ReadingLog.js';

export const READING_ROADMAP = [
  { title: 'Foundations and Personal Discipline', description: 'Build durable habits and bias toward action.', category: 'Personal development', books: [['Build Don’t Talk', 'Raj Shamani', 'A practical guide to taking action, building skills, and turning ideas into work.', 'Entrepreneurship'], ['Atomic Habits', 'James Clear', 'A system for building better habits through small, repeatable changes.', 'Personal development']] },
  { title: 'Startup Thinking', description: 'Explore startup experimentation, value creation, and company building.', category: 'Entrepreneurship', books: [['The Lean Startup', 'Eric Ries', 'A framework for validated learning and iterative startup development.', 'Startups'], ['Zero to One', 'Peter Thiel', 'Ideas on creating new value and building distinctive companies.', 'Startups']] },
  { title: 'Sales and Persuasion', description: 'Study consultative selling and the psychology of influence.', category: 'Sales and psychology', books: [['SPIN Selling', 'Neil Rackham', 'Research-backed framework for high-value B2B sales conversations.', 'Sales'], ['Influence: The Psychology of Persuasion', 'Robert Cialdini', 'A study of principles that shape persuasion and decision-making.', 'Psychology']] },
  { title: 'Business Execution', description: 'Turn focused ideas into practical, resilient business execution.', category: 'Business', books: [['Rework', 'Jason Fried and David Heinemeier Hansson', 'A practical challenge to conventional assumptions about work and business.', 'Business'], ['The Hard Thing About Hard Things', 'Ben Horowitz', 'Lessons on leading through the difficult realities of building a business.', 'Leadership']] },
  { title: 'Financial Intelligence', description: 'Develop a thoughtful relationship with money and long-term decisions.', category: 'Finance', books: [['The Psychology of Money', 'Morgan Housel', 'Stories about how behavior shapes financial outcomes.', 'Finance'], ['Rich Dad Poor Dad', 'Robert Kiyosaki', 'A personal finance book about financial education and assets.', 'Finance']] },
  { title: 'Leadership', description: 'Explore leadership, trust, and building teams.', category: 'Leadership', books: [['Leaders Eat Last', 'Simon Sinek', 'Ideas about trust, safety, and leadership in teams.', 'Leadership'], null] }
];

const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function createOrGetPhase(userId, values) {
  return ReadingPhase.findOneAndUpdate({ userId, sequence: values.sequence }, { $setOnInsert: { userId, ...values } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

export async function ensureReadingLibrary(userId) {
  {
    const tracks = [];
    for (let index = 0; index < 2; index += 1) {
      let track = await ReadingTrack.findOne({ userId, sequence: index + 1 });
      if (!track) track = await ReadingTrack.create({ userId, name: `Track ${index === 0 ? 'A' : 'B'}`, sequence: index + 1 });
      tracks.push(track);
    }
    for (let phaseIndex = 0; phaseIndex < READING_ROADMAP.length; phaseIndex += 1) {
      const source = READING_ROADMAP[phaseIndex];
      const sequence = phaseIndex + 1;
      const phase = await createOrGetPhase(userId, { title: source.title, description: source.description, category: source.category, sequence, status: 'active' });
      for (let bookIndex = 0; bookIndex < 2; bookIndex += 1) {
        const track = tracks[bookIndex];
        const bookData = source.books[bookIndex];
        if (bookData) {
          const [title, author, description, category] = bookData;
          const existing = await ReadingBook.findOne({ userId, phaseId: phase._id, trackId: track._id });
          if (!existing) await ReadingBook.create({ userId, phaseId: phase._id, trackId: track._id, sequence, title, author, description, category, status: sequence === 1 ? 'available' : 'upcoming' });
        }
      }
    }
  }

  // Attach older title-based session records to stable book IDs without
  // changing or deleting any session fields.
  const books = await ReadingBook.find({ userId });
  const byTitle = new Map(books.map(book => [normalize(book.title), book]));
  const legacyLogs = await ReadingLog.find({ userId, $or: [{ bookId: null }, { bookId: { $exists: false } }] }).sort({ date: 1, createdAt: 1 });
  let importedPhase = null;
  let importedTrack = null;
  for (const log of legacyLogs) {
    let book = byTitle.get(normalize(log.bookTitle));
    if (!book) {
      if (!importedPhase) {
        importedPhase = await ReadingPhase.findOneAndUpdate({ userId, sequence: 99 }, { $setOnInsert: { userId, sequence: 99, title: 'Earlier Reading', description: 'Books from your existing reading history.', category: 'Imported history', status: 'active' } }, { upsert: true, new: true });
        importedTrack = await ReadingTrack.findOne({ userId, name: 'Imported' });
        if (!importedTrack) importedTrack = await ReadingTrack.create({ userId, sequence: 99, name: 'Imported' });
      }
      const normalizedTitle = normalize(log.bookTitle);
      book = await ReadingBook.findOne({ userId, phaseId: importedPhase._id, trackId: importedTrack._id, title: log.bookTitle });
      if (!book) book = await ReadingBook.create({ userId, phaseId: importedPhase._id, trackId: importedTrack._id, sequence: books.filter(item => String(item.phaseId) === String(importedPhase._id)).length + 1, title: log.bookTitle, author: log.author || 'Unknown author', category: 'Imported history', description: 'Imported from an existing reading session.', status: 'reading', isLegacy: true });
      byTitle.set(normalizedTitle, book);
      books.push(book);
    }
    log.bookId = book._id;
    await log.save();
  }

  await syncReadingProgress(userId);
  await unlockNextBooks(userId);
  return { phases: await ReadingPhase.find({ userId }).sort({ sequence: 1 }).lean(), tracks: await ReadingTrack.find({ userId }).sort({ sequence: 1 }).lean(), books: await ReadingBook.find({ userId }).populate('phaseId').populate('trackId').lean() };
}

function uniquePages(logs) {
  const ranges = [];
  for (const log of logs) {
    const start = Math.max(0, Number(log.startPage) || 0);
    const end = Math.max(start, Number(log.endPage) || 0);
    // Existing UI treats pagesRead as end - start: count (start, end].
    if (end > start) ranges.push([start + 1, end]);
  }
  ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let total=0, low=null, high=null;
  for(const [start,end] of ranges){if(low===null){low=start;high=end;}else if(start<=high+1){high=Math.max(high,end);}else{total+=high-low+1;low=start;high=end;}}
  return low===null?0:total+high-low+1;
}

export async function syncReadingProgress(userId, bookId = null) {
  const books = await ReadingBook.find({ userId, ...(bookId ? { _id: bookId } : {}) });
  for (const book of books) {
    const logs = await ReadingLog.find({ userId, bookId: book._id }).sort({ date: 1, createdAt: 1 });
    const last = logs.at(-1);
    book.pagesRead = uniquePages(logs);
    book.currentPage = last ? Number(last.endPage) || 0 : 0;
    book.lastReadAt = last ? new Date(`${last.date}T12:00:00.000Z`) : null;
    book.readingProgress = book.totalPages ? Math.min(100, Math.round(book.currentPage / book.totalPages * 100)) : 0;
    await book.save();
  }
}

export async function unlockNextBooks(userId) {
  const tracks = await ReadingTrack.find({ userId });
  for (const track of tracks) {
    const books = await ReadingBook.find({ userId, trackId: track._id, status: { $ne: 'archived' } }).populate('phaseId');
    books.sort((a,b)=>a.sequence-b.sequence||(a.phaseId?.sequence||99)-(b.phaseId?.sequence||99)||a.createdAt-b.createdAt);
    const statuses=computeTrackProgression(books.map(book=>book.status));
    for(let index=0;index<books.length;index+=1)if(books[index].status!==statuses[index]){books[index].status=statuses[index];await books[index].save();}
  }
}

export function computeTrackProgression(bookStatuses) {
  let previousCompleted=true;
  return bookStatuses.map(status=>{
    let next=status;
    if(status==='completed')previousCompleted=true;
    else{
      if(status==='upcoming'&&previousCompleted)next='available';
      else if(status==='available'&&!previousCompleted)next='upcoming';
      if(['available','reading','paused'].includes(next))previousCompleted=false;
    }
    return next;
  });
}

export { uniquePages };
