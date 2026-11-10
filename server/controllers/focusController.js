import { FocusSession } from '../models/FocusSession.js';
import { Task } from '../models/Task.js';

export async function getActiveSession(req, res, next) {
  try {
    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ['active', 'paused'] }
    }).sort({ startTime: -1 });

    if (!session) {
      return res.json({ success: true, active: false, session: null });
    }

    session.calculateActualDuration();

    return res.json({
      success: true,
      active: true,
      session: {
        id: session._id,
        title: session.title,
        targetMinutes: session.targetMinutes,
        actualMinutes: session.actualMinutes,
        status: session.status,
        startTime: session.startTime,
        pauses: session.pauses,
        taskId: session.taskId,
        courseSlug: session.courseSlug,
        lectureId: session.lectureId
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function startSession(req, res, next) {
  try {
    const { title, targetMinutes = 25, taskId, courseSlug, lectureId, category = 'general' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Focus session title is required.' });
    }

    // End any lingering active session
    const existing = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ['active', 'paused'] }
    });
    if (existing) {
      existing.status = 'cancelled';
      existing.endTime = new Date();
      existing.calculateActualDuration();
      await existing.save();
    }

    const session = await FocusSession.create({
      userId: req.user.id,
      title: title.trim(),
      targetMinutes: Number(targetMinutes) || 25,
      taskId: taskId || null,
      courseSlug: courseSlug || null,
      lectureId: lectureId || null,
      category,
      startTime: new Date(),
      status: 'active'
    });

    return res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function pauseSession(req, res, next) {
  try {
    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: 'active'
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'No active focus session found to pause.' });
    }

    session.status = 'paused';
    session.interruptionsCount = (session.interruptionsCount || 0) + 1;
    session.pauses.push({ pausedAt: new Date() });
    session.calculateActualDuration();
    await session.save();

    return res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function resumeSession(req, res, next) {
  try {
    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: 'paused'
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'No paused focus session found to resume.' });
    }

    // Set resumedAt on the last pause
    if (session.pauses.length > 0) {
      const lastPause = session.pauses[session.pauses.length - 1];
      if (!lastPause.resumedAt) {
        lastPause.resumedAt = new Date();
      }
    }

    session.status = 'active';
    session.calculateActualDuration();
    await session.save();

    return res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function completeSession(req, res, next) {
  try {
    const { notes } = req.body;
    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ['active', 'paused'] }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'No active or paused focus session to complete.' });
    }

    session.endTime = new Date();
    session.status = 'completed';
    session.notes = notes || session.notes || '';
    session.calculateActualDuration();
    await session.save();

    // If linked to a task, update task's actual minutes and remaining minutes!
    let updatedTask = null;
    if (session.taskId) {
      const task = await Task.findOne({ _id: session.taskId, userId: req.user.id });
      if (task) {
        task.actualMinutes = (task.actualMinutes || 0) + session.actualMinutes;
        task.remainingMinutes = Math.max(0, task.estimatedMinutes - task.actualMinutes);
        if (task.remainingMinutes === 0) {
          task.status = 'completed';
          task.completedAt = new Date();
        } else {
          task.status = 'in-progress';
        }
        await task.save();
        updatedTask = task;
      }
    }

    return res.json({
      success: true,
      message: `Focus session completed! Logged ${session.actualMinutes} focused minutes.`,
      session,
      task: updatedTask
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelSession(req, res, next) {
  try {
    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ['active', 'paused'] }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'No active session to cancel.' });
    }

    session.status = 'cancelled';
    session.endTime = new Date();
    session.calculateActualDuration();
    await session.save();

    return res.json({ success: true, message: 'Focus session cancelled.' });
  } catch (err) {
    next(err);
  }
}

export async function getFocusHistory(req, res, next) {
  try {
    const sessions = await FocusSession.find({
      userId: req.user.id,
      status: 'completed'
    }).sort({ createdAt: -1 }).limit(50);

    const totalMinutes = sessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);

    return res.json({
      success: true,
      count: sessions.length,
      totalMinutes,
      sessions
    });
  } catch (err) {
    next(err);
  }
}
