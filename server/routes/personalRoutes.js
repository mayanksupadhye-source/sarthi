import express from 'express';
import {
  getFitnessLogs,
  createFitnessLog,
  getWeightLogs,
  recordWeightLog,
  getFitnessQuote,
  getHabits,
  toggleHabitCheckin,
  getNotes,
  createNote,
  updateNote,
  getReadingLogs,
  createReadingLog,
  getMarketConcepts,
  addPaperLog,
  getRewardsAndSavings,
  addSavingsContribution
} from '../controllers/personalController.js';
import { authenticate } from '../middleware/auth.js';
import { getJournalEntries, createJournalEntry, updateJournalEntry } from '../controllers/journalController.js';
import { getReadingLibrary, createReadingSession, createReadingPhase, createReadingBook, updateReadingBook, reorderReadingBooks, updateReadingSession, deleteReadingSession, getBookSessions, updateReadingPhase, reorderReadingPhases, deleteReadingBook } from '../controllers/readingController.js';

const router = express.Router();
router.use(authenticate);

// Fitness & Weight
router.get('/fitness', getFitnessLogs);
router.post('/fitness', createFitnessLog);
router.get('/weight', getWeightLogs);
router.post('/weight', recordWeightLog);
router.get('/fitness-quote', getFitnessQuote);

// Habits
router.get('/habits', getHabits);
router.post('/habits/checkin', toggleHabitCheckin);

// Notes & Reflection & Reset Room
router.get('/journals', getJournalEntries);
router.post('/journals', createJournalEntry);
router.put('/journals/:id', updateJournalEntry);
router.get('/notes', getNotes);
router.post('/notes', createNote);
router.put('/notes/:id', updateNote);

// Reading
router.get('/reading', getReadingLibrary);
router.post('/reading', createReadingSession);
router.post('/reading/phases', createReadingPhase);
router.put('/reading/phases/reorder', reorderReadingPhases);
router.put('/reading/phases/:id', updateReadingPhase);
router.post('/reading/books', createReadingBook);
router.put('/reading/books/reorder', reorderReadingBooks);
router.get('/reading/books/:bookId/sessions', getBookSessions);
router.delete('/reading/books/:id', deleteReadingBook);
router.put('/reading/books/:id', updateReadingBook);
router.put('/reading/sessions/:id', updateReadingSession);
router.delete('/reading/sessions/:id', deleteReadingSession);

// Share Market Education
router.get('/market', getMarketConcepts);
router.post('/market/:conceptId/paper', addPaperLog);

// Rewards & Savings
router.get('/rewards-savings', getRewardsAndSavings);
router.post('/savings/contribute', addSavingsContribution);

export default router;
