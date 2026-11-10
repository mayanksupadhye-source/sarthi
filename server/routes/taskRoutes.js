import express from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  recordPartialCompletion,
  completeTask,
  deferTask
} from '../controllers/taskController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/partial', recordPartialCompletion);
router.post('/:id/complete', completeTask);
router.post('/:id/defer', deferTask);

export default router;
