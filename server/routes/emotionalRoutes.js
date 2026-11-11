import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { computeDayState } from '../services/dayStateEngine.js';
import { getContextualMessage, recordFeedback } from '../services/copyEngine.js';
import { UserProfile } from '../models/UserProfile.js';
import { DailyPlan } from '../models/DailyPlan.js';
import { Task } from '../models/Task.js';
import { seedUserProfile } from '../services/copySeeder.js';

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/emotional/day-state
 * Returns computed dayState, relevant copy message, and block rescue context.
 */
router.get('/day-state', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const stateInfo = await computeDayState(userId, today);
    
    // Get contextual message from copy engine
    const message = await getContextualMessage({
      userId,
      dayState: stateInfo.dayState,
      surface: 'today',
      tokens: {
        minutesLate: stateInfo.minutesLate || 0,
        minutesLeft: stateInfo.minutesLeft || 0,
        sliceTitle: stateInfo.sliceTitle || 'first 10-minute slice',
        blockName: stateInfo.blockName || 'focus block',
        done: stateInfo.doneCount || 0,
        total: (stateInfo.doneCount || 0) + (stateInfo.pendingCount || 0)
      }
    });

    return res.json({
      success: true,
      today,
      ...stateInfo,
      message
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/emotional/low-energy
 * Toggles low-energy minimum day (P1 only, optional tasks hidden, gym swapped to walk or rest).
 */
router.post('/low-energy', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const { action = 'activate' } = req.body; // 'activate' or 'deactivate'

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      { $set: { isLowEnergy: action === 'activate' } },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      isLowEnergy: plan.isLowEnergy,
      message: plan.isLowEnergy
        ? 'Minimum day mode on. Essentials only, optional work tucked away.'
        : 'Standard execution mode restored.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/emotional/rest-day
 * Records an approved rest day. Counts as a valid show-up; protects streak.
 */
router.post('/rest-day', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const { note = 'Intentional recovery and rest' } = req.body;

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $set: {
          isRestApproved: true,
          replanReason: note
        }
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      isRestApproved: true,
      message: 'Rest day recorded. Streak intact. See you tomorrow.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/emotional/close-day
 * 60-Second End-of-Day Ritual:
 * Bank completed work, record reflection, and pre-lock tomorrow's first task.
 */
router.post('/close-day', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const { tomorrowFirstTask = '', energyLevel = 3, reflectionNote = '' } = req.body;

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $set: {
          isClosed: true,
          closedAt: new Date(),
          tomorrowFirstTask: tomorrowFirstTask.trim(),
          reflectionNote: reflectionNote.trim()
        }
      },
      { upsert: true, new: true }
    );

    // If tomorrow first task is specified, ensure it is queued
    if (tomorrowFirstTask.trim()) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      await Task.create({
        userId,
        title: tomorrowFirstTask.trim(),
        priority: 'P1',
        scheduledDate: tomorrow,
        estimatedMinutes: 25,
        status: 'pending'
      }).catch(() => {});
    }

    return res.json({
      success: true,
      plan,
      message: 'Day closed and banked. Tomorrow starts with one clear task.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET & PUT /api/emotional/profile
 * "How this app talks to me" configuration & Evidence Locker
 */
router.get('/profile', async (req, res, next) => {
  try {
    let profile = await UserProfile.findOne({ userId: req.user.id });
    if (!profile) {
      profile = await seedUserProfile(req.user.id);
    }
    return res.json({ success: true, profile });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const updates = { ...req.body };
    delete updates.userId;

    const profile = await UserProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { upsert: true, new: true }
    );

    return res.json({ success: true, profile });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/emotional/evidence
 * Add an entry to the Evidence Locker ("Receipts")
 */
router.post('/evidence', async (req, res, next) => {
  try {
    const { title, period = '', note = '', tags = [] } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    let profile = await UserProfile.findOne({ userId: req.user.id });
    if (!profile) {
      profile = await seedUserProfile(req.user.id);
    }

    profile.evidence.push({
      title: title.trim(),
      period: period.trim(),
      note: note.trim(),
      tags: Array.isArray(tags) ? tags : [tags],
      autoAdded: false,
      verifiedAt: new Date()
    });

    await profile.save();
    return res.status(201).json({ success: true, evidence: profile.evidence });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/emotional/feedback
 * Records thumbs-up / thumbs-down on a copy engine message
 */
router.post('/feedback', async (req, res, next) => {
  try {
    const { messageId, feedback } = req.body;
    if (!messageId || !['thumbs_up', 'thumbs_down'].includes(feedback)) {
      return res.status(400).json({ success: false, error: 'Valid messageId and feedback required.' });
    }

    const updated = await recordFeedback(messageId, feedback);
    return res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
});

export default router;
