import mongoose from "mongoose";
import { FocusSession } from "../models/FocusSession.js";
import { Task } from "../models/Task.js";
import { ExecutionSyncService } from "../services/executionSyncService.js";
import { getTodayString } from "../utils/timeFormat.js";
import {
  getFocusHistoryFilter,
  normalizeFocusHistoryPagination,
  FOCUS_HISTORY_PERIODS,
  validateFocusReflection,
} from "../services/focusHistory.js";

export async function getActiveSession(req, res, next) {
  try {
    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ["active", "paused"] },
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
        lectureId: session.lectureId,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function startSession(req, res, next) {
  try {
    const {
      title,
      targetMinutes = 25,
      taskId,
      courseSlug,
      lectureId,
      category = "general",
    } = req.body;

    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Focus session title is required." });
    }

    // End any lingering active session
    const existing = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ["active", "paused"] },
    });
    if (existing) {
      const cancelledAt = new Date();
      existing.endTime = cancelledAt;
      existing.calculateActualDuration(cancelledAt);
      existing.status = "cancelled";
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
      status: "active",
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
      status: "active",
    });

    if (!session) {
      return res
        .status(404)
        .json({
          success: false,
          error: "No active focus session found to pause.",
        });
    }

    session.status = "paused";
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
      status: "paused",
    });

    if (!session) {
      return res
        .status(404)
        .json({
          success: false,
          error: "No paused focus session found to resume.",
        });
    }

    // Set resumedAt on the last pause
    if (session.pauses.length > 0) {
      const lastPause = session.pauses[session.pauses.length - 1];
      if (!lastPause.resumedAt) {
        lastPause.resumedAt = new Date();
      }
    }

    session.status = "active";
    session.calculateActualDuration();
    await session.save();

    return res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

export async function completeSession(req, res, next) {
  try {
    const reflection = validateFocusReflection(req.body.notes);
    if (!reflection.valid)
      return res.status(400).json({ success: false, error: reflection.error });

    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ["active", "paused"] },
    });

    if (!session) {
      return res
        .status(404)
        .json({
          success: false,
          error: "No active or paused focus session to complete.",
        });
    }

    const completedAt = new Date();
    session.endTime = completedAt;
    session.calculateActualDuration(completedAt);
    session.status = "completed";
    session.notes = reflection.value;
    await session.save();

    // Canonical progress recording: If linked to a task, synchronize via ExecutionSyncService!
    let updatedTask = null;
    let executionRecord = null;
    if (session.taskId && session.actualMinutes > 0) {
      const today = getTodayString();
      const opId = `focus_${session._id.toString()}`;
      const syncResult = await ExecutionSyncService.recordWork({
        userId: req.user.id,
        taskId: session.taskId,
        courseSlug: session.courseSlug || null,
        minutesSpent: session.actualMinutes,
        date: today,
        type: "focus",
        notes: reflection.value || `Focus Session: ${session.title}`,
        isCompleted: false, // let recordWork mark completed if remainingMinutes reaches 0
        operationId: opId,
      });
      if (syncResult) {
        updatedTask = syncResult.task;
        executionRecord = syncResult.executionRecord;
      }
    } else if (session.taskId) {
      updatedTask = await Task.findOne({ _id: session.taskId, userId: req.user.id });
    }

    return res.json({
      success: true,
      message: `Focus session completed! Logged ${session.actualMinutes} focused minutes.`,
      session,
      task: updatedTask,
      executionRecord,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelSession(req, res, next) {
  try {
    const session = await FocusSession.findOne({
      userId: req.user.id,
      status: { $in: ["active", "paused"] },
    });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "No active session to cancel." });
    }

    const cancelledAt = new Date();
    session.endTime = cancelledAt;
    session.calculateActualDuration(cancelledAt);
    session.status = "cancelled";
    await session.save();

    return res.json({ success: true, message: "Focus session cancelled." });
  } catch (err) {
    next(err);
  }
}

export async function getFocusHistory(req, res, next) {
  try {
    const period = req.query.period || "30d";
    if (!FOCUS_HISTORY_PERIODS.includes(period)) {
      return res
        .status(400)
        .json({
          success: false,
          error: `period must be one of: ${FOCUS_HISTORY_PERIODS.join(", ")}.`,
        });
    }

    const now = new Date();
    const filter = getFocusHistoryFilter(req.user.id, period, now);
    const { page: requestedPage, limit } = normalizeFocusHistoryPagination(
      req.query,
    );
    const [totalCount, aggregate] = await Promise.all([
      FocusSession.countDocuments(filter),
      FocusSession.aggregate([
        {
          $match: {
            ...filter,
            userId: new mongoose.Types.ObjectId(req.user.id),
          },
        },
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: { $ifNull: ["$actualMinutes", 0] } },
          },
        },
      ]),
    ]);
    const pages = Math.ceil(totalCount / limit);
    const page = pages ? Math.min(requestedPage, pages) : 1;
    const sessions = await FocusSession.find(filter)
      .sort({ endTime: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const totalMinutes = aggregate[0]?.totalMinutes || 0;
    const start = totalCount ? (page - 1) * limit + 1 : 0;
    const end = Math.min(page * limit, totalCount);

    return res.json({
      success: true,
      period,
      count: totalCount,
      totalMinutes,
      sessions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages,
        start,
        end,
        hasPrevious: page > 1,
        hasNext: page < pages,
      },
    });
  } catch (err) {
    next(err);
  }
}
