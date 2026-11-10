import express from 'express';
import {
  getFitnessLogs,
  createFitnessLog,
  getWeightLogs,
  recordWeightLog,
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

const router = express.Router();
router.use(authenticate);

// Fitness & Weight
router.get('/fitness', getFitnessLogs);
router.post('/fitness', createFitnessLog);
router.get('/weight', getWeightLogs);
router.post('/weight', recordWeightLog);

// Habits
router.get('/habits', getHabits);
router.post('/habits/checkin', toggleHabitCheckin);

// Notes & Reflection & Reset Room
router.get('/notes', getNotes);
router.post('/notes', createNote);
router.put('/notes/:id', updateNote);

// Reading
router.get('/reading', getReadingLogs);
router.post('/reading', createReadingLog);

// Share Market Education
router.get('/market', getMarketConcepts);
router.post('/market/:conceptId/paper', addPaperLog);

// Rewards & Savings
router.get('/rewards-savings', getRewardsAndSavings);
router.post('/savings/contribute', addSavingsContribution);

export default router;
