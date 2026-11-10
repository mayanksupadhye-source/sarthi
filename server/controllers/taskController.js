import { Task } from '../models/Task.js';

export async function getTasks(req, res, next) {
  try {
    const { status, priority, category, date, backlog } = req.query;
    const filter = { userId: req.user.id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    
    if (backlog === 'true') {
      filter.$or = [{ scheduledDate: null }, { scheduledDate: '' }, { isDeferred: true }];
    } else if (date) {
      filter.scheduledDate = date;
    }

    const tasks = await Task.find(filter)
      .populate('dependencies', 'title status priority')
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
      priority = 'P2',
      category = 'general',
      estimatedMinutes = 30,
      scheduledDate,
      deadline,
      dependencies = [],
      isProtected = false
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title is required.' });
    }

    const task = await Task.create({
      userId: req.user.id,
      title: title.trim(),
      description: (description || '').trim(),
      priority,
      category,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      actualMinutes: 0,
      remainingMinutes: Number(estimatedMinutes) || 30,
      scheduledDate: scheduledDate || null,
      deadline: deadline || null,
      dependencies,
      isProtected: Boolean(isProtected)
    });

    return res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.userId;

    const task = await Task.findOne({ _id: id, userId: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
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
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }
    return res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function recordPartialCompletion(req, res, next) {
  try {
    const { id } = req.params;
    const { minutesSpent, notes } = req.body;

    if (!minutesSpent || Number(minutesSpent) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid minutesSpent is required.' });
    }

    const task = await Task.findOne({ _id: id, userId: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }

    task.actualMinutes = (task.actualMinutes || 0) + Number(minutesSpent);
    task.remainingMinutes = Math.max(0, task.estimatedMinutes - task.actualMinutes);
    
    if (task.remainingMinutes === 0) {
      task.status = 'completed';
      task.completedAt = new Date();
    } else {
      task.status = 'in-progress';
    }

    if (notes) {
      task.description = task.description ? `${task.description}\n[Progress Note]: ${notes}` : notes;
    }

    await task.save();

    return res.json({
      success: true,
      message: `Preserved ${task.actualMinutes} min of completed effort. Remaining: ${task.remainingMinutes} min.`,
      task
    });
  } catch (err) {
    next(err);
  }
}

export async function completeTask(req, res, next) {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ _id: id, userId: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }

    task.status = 'completed';
    task.completedAt = new Date();
    task.remainingMinutes = 0;
    if (task.actualMinutes === 0) {
      task.actualMinutes = task.estimatedMinutes;
    }

    await task.save();

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
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }

    task.isDeferred = true;
    task.deferReason = reason || 'Intentionally deferred to protect focus';
    task.scheduledDate = newDate || null;
    task.status = 'deferred';

    await task.save();

    return res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
}
