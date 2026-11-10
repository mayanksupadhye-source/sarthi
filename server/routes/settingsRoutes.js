import express from 'express';
import {
  getSettings,
  updateSettings,
  exportAllUserData,
  getIntegrationStatus
} from '../controllers/settingsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getSettings);
router.put('/', updateSettings);
router.get('/export', exportAllUserData);
router.get('/integrations/status', getIntegrationStatus);

export default router;
