import express from 'express';
import {
  getToday,
  replanDay,
  confirmReplan,
  getSlackDays,
  recordAvailability,
  getRecoveryStatus,
  acceptRecoveryOpportunity,
  allocateCurriculum,
  saveDailyReflection,
  getCalendarEvents
} from '../controllers/plannerController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/today', getToday);
router.post('/replan', replanDay);
router.post('/replan/confirm', confirmReplan);
router.get('/slack-days', getSlackDays);
router.post('/availability', recordAvailability);
router.get('/recovery', getRecoveryStatus);
router.post('/recovery/accept', acceptRecoveryOpportunity);
router.post('/allocate-curriculum', allocateCurriculum);
router.put('/reflection', saveDailyReflection);
router.get('/calendar-events', getCalendarEvents);

export default router;
