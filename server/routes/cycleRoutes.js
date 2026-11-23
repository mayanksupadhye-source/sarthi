import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createPeriodRecord,
  deleteDailyCycleLog,
  deletePeriodRecord,
  getCycleCalendar,
  getCycleIntelligence,
  getCyclePredictions,
  getCycleProfile,
  getDailyCycleLogs,
  getPeriodRecords,
  updateCycleProfile,
  updatePeriodRecord,
  upsertDailyCycleLog
} from '../controllers/cycleController.js';

const router = express.Router();
router.use(authenticate);

router.get('/profile', getCycleProfile);
router.put('/profile', updateCycleProfile);
router.get('/intelligence', getCycleIntelligence);
router.get('/calendar', getCycleCalendar);
router.get('/predictions', getCyclePredictions);
router.get('/periods', getPeriodRecords);
router.post('/periods', createPeriodRecord);
router.put('/periods/:id', updatePeriodRecord);
router.delete('/periods/:id', deletePeriodRecord);
router.get('/logs', getDailyCycleLogs);
router.post('/logs', upsertDailyCycleLog);
router.delete('/logs/:id', deleteDailyCycleLog);

export default router;
