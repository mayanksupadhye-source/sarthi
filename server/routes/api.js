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
import emotionalRoutes from './emotionalRoutes.js';
import { getDBStatus, requireDB } from '../config/db.js';

const router = express.Router();

// Health check endpoint (always reachable, reports real DB connectivity status)
router.get('/health', (req, res) => {
  const dbStatus = getDBStatus();
  res.json({
    status: dbStatus.connected ? 'healthy' : 'degraded',
    api: {
      ready: true,
      service: 'SARTHI Personal Execution & Student OS',
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.nodeEnv,
      timezone: config.timezone
    },
    database: {
      connected: dbStatus.connected,
      readyState: dbStatus.readyState,
      host: dbStatus.host,
      name: dbStatus.name
    },
    timestamp: new Date().toISOString()
  });
});

// Guard: Require active database connection for all data-dependent routes
// Prevents 10000ms Mongoose buffering timeout; returns immediate HTTP 503 instead
router.use(requireDB);

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
router.use('/emotional', emotionalRoutes);

export default router;
