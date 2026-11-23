import express from 'express';
import {
  getHackathons,
  createHackathon,
  updateHackathon,
  updateHackathonStatus,
  markHackathonNotificationRead,
  deleteHackathon
} from '../controllers/hackathonController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getHackathons);
router.post('/', createHackathon);
router.put('/:id', updateHackathon);
router.put('/:id/status', updateHackathonStatus);
router.put('/notifications/:id/read', markHackathonNotificationRead);
router.delete('/:id', deleteHackathon);

export default router;
