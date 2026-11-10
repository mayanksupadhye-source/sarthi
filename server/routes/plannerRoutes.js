import express from 'express';
import {
  getToday,
  replanDay,
  confirmReplan,
  getSlackDays
} from '../controllers/plannerController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/today', getToday);
router.post('/replan', replanDay);
router.post('/replan/confirm', confirmReplan);
router.get('/slack-days', getSlackDays);

export default router;
