import express from 'express';
import {
  getCourses,
  getCourseBySlug,
  updateLectureProgress,
  addCourseSection,
  getOratoryWeeks,
  updateOratoryWeek
} from '../controllers/courseController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getCourses);
router.get('/oratory/weeks', getOratoryWeeks);
router.put('/oratory/weeks/:weekNumber', updateOratoryWeek);
router.post('/:slug/section', addCourseSection);
router.get('/:slug', getCourseBySlug);
router.put('/:slug/lecture/:lectureId', updateLectureProgress);

export default router;
