import express from 'express';
import { getReminderPlan } from '../controllers/reminderController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/plan', authenticate, getReminderPlan);

export default router;
