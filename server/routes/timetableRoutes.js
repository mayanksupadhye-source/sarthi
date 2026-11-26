import express from 'express';
import {
  getTemplates,
  getTemplateByDayType,
  updateTemplate,
  createTemplateVersion,
  addBlockToTemplate,
  updateBlockInTemplate,
  deleteBlockFromTemplate,
  getScheduleExceptions,
  createScheduleException,
  deleteScheduleException,
  detectConflicts,
  getActivations,
  createActivation,
  updateActivation,
  deleteActivation
} from '../controllers/timetableController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Template Routes
router.get('/templates', getTemplates);
router.post('/templates/version', createTemplateVersion);
router.get('/templates/:dayType', getTemplateByDayType);
router.put('/templates/:id', updateTemplate);
router.post('/templates/:id/blocks', addBlockToTemplate);
router.put('/templates/:id/blocks/:blockId', updateBlockInTemplate);
router.delete('/templates/:id/blocks/:blockId', deleteBlockFromTemplate);

// Schedule Exceptions (Date-specific overrides)
router.get('/exceptions', getScheduleExceptions);
router.post('/exceptions', createScheduleException);
router.delete('/exceptions/:id', deleteScheduleException);

// Conflict Detection
router.get('/conflicts', detectConflicts);

// Profile Activations (Date range overrides: "Use this timetable from start to end")
router.get('/activations', getActivations);
router.post('/activations', createActivation);
router.put('/activations/:id', updateActivation);
router.delete('/activations/:id', deleteActivation);

export default router;
