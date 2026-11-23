import express from 'express';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseBySlug,
  updateLectureProgress,
  addCourseSection,
  getOratoryWeeks,
  updateOratoryWeek,
  createOratoryActivity,
  deleteOratoryActivity,
  createCourseActivity,
  logCourseSession,
  downloadCsvTemplate,
  previewCsvImport,
  previewImportDiff,
  commitCsvImport,
  getCourseActivities,
  completeCourseActivity,
  logPartialCourseActivity,
  distributeCourse
} from '../controllers/courseController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getCourses);
router.post('/', createCourse);
router.get('/oratory/template/csv', (req, res, next) => { req.query.kind = 'oratory'; return downloadCsvTemplate(req, res, next); });
router.get('/oratory/weeks', getOratoryWeeks);
router.post('/oratory/activities', createOratoryActivity);
router.delete('/oratory/activities/:weekNumber', deleteOratoryActivity);
router.put('/oratory/weeks/:weekNumber', updateOratoryWeek);

// Curriculum Importer & Activity Execution Hub (prioritized before /:slug)
router.get('/template/csv', downloadCsvTemplate);
router.post('/import/preview', previewCsvImport);
router.post('/import/diff', previewImportDiff);
router.post('/import/commit', commitCsvImport);
router.put('/activities/:id/complete', completeCourseActivity);
router.post('/activities/:id/partial', logPartialCourseActivity);

// Slug-specific routes
router.post('/:slug/distribute', distributeCourse);
router.get('/:slug/activities', getCourseActivities);
router.post('/:slug/activities', createCourseActivity);
router.post('/:slug/log-session', logCourseSession);
router.post('/:slug/section', addCourseSection);
router.get('/:slug', getCourseBySlug);
router.put('/:slug', updateCourse);
router.delete('/:slug', deleteCourse);
router.put('/:slug/lecture/:lectureId', updateLectureProgress);

export default router;
