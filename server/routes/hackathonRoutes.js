import express from 'express';
import {
  getHackathons,
  createHackathon,
  updateHackathon,
  deleteHackathon
} from '../controllers/hackathonController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getHackathons);
router.post('/', createHackathon);
router.put('/:id', updateHackathon);
router.delete('/:id', deleteHackathon);

export default router;
