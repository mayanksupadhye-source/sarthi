import express from 'express';
import {
  getSubjects,
  createSubject,
  markAttendance,
  getAttendanceHistory,
  getAssignments,
  createAssignment,
  updateAssignment,
  getExaminations,
  createExamination,
  toggleExamMode
} from '../controllers/academicController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.post('/attendance', markAttendance);
router.get('/attendance/history', getAttendanceHistory);
router.get('/assignments', getAssignments);
router.post('/assignments', createAssignment);
router.put('/assignments/:id', updateAssignment);
router.get('/exams', getExaminations);
router.post('/exams', createExamination);
router.post('/exam-mode', toggleExamMode);

export default router;
