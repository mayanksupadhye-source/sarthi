import express from 'express';
import {
  getTemplates,
  getTemplateByDayType,
  updateTemplate,
  detectConflicts
} from '../controllers/timetableController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/templates', getTemplates);
router.get('/templates/:dayType', getTemplateByDayType);
router.put('/templates/:id', updateTemplate);
router.get('/conflicts', detectConflicts);

export default router;
