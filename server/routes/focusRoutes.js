import express from 'express';
import {
  getActiveSession,
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  cancelSession,
  getFocusHistory
} from '../controllers/focusController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/active', getActiveSession);
router.post('/start', startSession);
router.post('/pause', pauseSession);
router.post('/resume', resumeSession);
router.post('/complete', completeSession);
router.post('/cancel', cancelSession);
router.get('/history', getFocusHistory);

export default router;
