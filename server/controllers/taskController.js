import { Task } from "../models/Task.js";
import { ExecutionSyncService } from "../services/executionSyncService.js";

export async function getTasks(req, res, next) {
  try {
    const { status, priority, category, date, backlog } = req.query;
    const filter = { userId: req.user.id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    if (backlog === "true") {
      filter.$or = [
        { scheduledDate: null },
        { scheduledDate: "" },
        { isDeferred: true },
      ];
    } else if (date) {
      filter.scheduledDate = date;
    }

    const tasks = await Task.find(filter)
      .populate("dependencies", "title status priority")
      .sort({ priority: 1, deadline: 1, createdAt: -1 });

    return res.json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    next(err);
  }
}

export async function createTask(req, res, next) {
  try {
    const {
      title,
      description,
      priority = "P2",
      category = "general",
      estimatedMinutes = 30,
      scheduledDate,
      deadline,
      dependencies = [],
      isProtected = false,
    } = req.body;

    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Task title is required." });
    }

    const task = await Task.create({
      userId: req.user.id,
      title: title.trim(),
      description: (description || "").trim(),
      priority,
      category,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      actualMinutes: 0,
      remainingMinutes: Number(estimatedMinutes) || 30,
      scheduledDate: scheduledDate || null,
      deadline: deadline || null,
      dependencies,
      isProtected: Boolean(isProtected),
    });

    return res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const allowedFields = [
      "title",
      "description",
      "priority",
      "status",
      "category",
      "estimatedMinutes",
      "actualMinutes",
      "remainingMinutes",
      "scheduledDate",
      "deadline",
      "dependencies",
      "isProtected",
      "isDeferred",
      "deferReason",
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (
      updates.estimatedMinutes !== undefined &&
      updates.estimatedMinutes < 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Estimated minutes cannot be negative.",
        });
    }
    if (updates.actualMinutes !== undefined && updates.actualMinutes < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Actual minutes cannot be negative." });
    }

    const task = await Task.findOne({ _id: id, userId: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }

    if (updates.status === "completed" && task.status !== "completed") {
      const completedTask = await ExecutionSyncService.completeTask({
        userId: req.user.id,
        taskId: id,
        actualMinutes: updates.actualMinutes || task.actualMinutes,
      });
      return res.json({ success: true, task: completedTask });
    }

    Object.assign(task, updates);
    await task.save();

    return res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const { id } = req.params;
    const task = await Task.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }
    return res.json({ success: true, message: "Task deleted successfully." });
  } catch (err) {
    next(err);
  }
}

export async function recordPartialCompletion(req, res, next) {
  try {
    const { id } = req.params;
    const { minutesSpent, notes, date, type = "regular" } = req.body;

    if (!minutesSpent || Number(minutesSpent) <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Valid minutesSpent is required." });
    }

    const result = await ExecutionSyncService.recordWork({
      userId: req.user.id,
      taskId: id,
      minutesSpent: Number(minutesSpent),
      date: date || new Date().toISOString().split("T")[0],
      type,
      notes: notes || "",
      isCompleted: false,
    });

    if (!result || !result.task) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }

    return res.json({
      success: true,
      message: `Preserved ${result.task.actualMinutes} min of completed effort. Remaining: ${result.task.remainingMinutes} min.`,
      task: result.task,
      executionRecord: result.executionRecord,
    });
  } catch (err) {
    next(err);
  }
}

export async function completeTask(req, res, next) {
  try {
    const { id } = req.params;
    const { actualMinutes } = req.body || {};

    const task = await ExecutionSyncService.completeTask({
      userId: req.user.id,
      taskId: id,
      actualMinutes,
    });

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }

    return res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export async function deferTask(req, res, next) {
  try {
    const { id } = req.params;
    const { newDate, reason } = req.body;

    const task = await Task.findOne({ _id: id, userId: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found." });
    }

    task.isDeferred = true;
    task.deferReason = reason || "Intentionally deferred to protect focus";
    task.scheduledDate = newDate || null;
    task.status = "deferred";

    await task.save();

    return res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
}
