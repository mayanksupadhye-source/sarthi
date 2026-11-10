import express from 'express';
import authRoutes from './authRoutes.js';
import taskRoutes from './taskRoutes.js';
import plannerRoutes from './plannerRoutes.js';
import timetableRoutes from './timetableRoutes.js';
import focusRoutes from './focusRoutes.js';
import courseRoutes from './courseRoutes.js';
import academicRoutes from './academicRoutes.js';
import hackathonRoutes from './hackathonRoutes.js';
import personalRoutes from './personalRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import insightsRoutes from './insightsRoutes.js';
import { getDBStatus } from '../config/db.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SARTHI',
    version: '1.0.0',
    database: getDBStatus(),
    timestamp: new Date().toISOString()
  });
});

router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/planner', plannerRoutes);
router.use('/timetable', timetableRoutes);
router.use('/focus', focusRoutes);
router.use('/courses', courseRoutes);
router.use('/academic', academicRoutes);
router.use('/academics', academicRoutes);
router.use('/hackathons', hackathonRoutes);
router.use('/personal', personalRoutes);
router.use('/settings', settingsRoutes);
router.use('/insights', insightsRoutes);

export default router;
