import { FitnessLog } from '../models/FitnessLog.js';
import { WeightLog } from '../models/WeightLog.js';
import { Habit } from '../models/Habit.js';
import { HabitLog } from '../models/HabitLog.js';
import { Note } from '../models/Note.js';
import { ReadingLog } from '../models/ReadingLog.js';
import { MarketConcept } from '../models/MarketConcept.js';
import { Reward, SavingsEntry } from '../models/Reward.js';
import { Setting } from '../models/Setting.js';

// --- FITNESS & WEIGHT ---
export async function getFitnessLogs(req, res, next) {
  try {
    const logs = await FitnessLog.find({ userId: req.user.id }).sort({ date: -1 }).limit(30);
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
}

export async function createFitnessLog(req, res, next) {
  try {
    const { date, workoutType, durationMinutes = 60, exercises = [], energyLevel = 3, notes = '' } = req.body;
    if (!date || !workoutType) {
      return res.status(400).json({ success: false, error: 'Date and workout type are required.' });
    }

    const log = await FitnessLog.create({
      userId: req.user.id,
      date,
      workoutType,
      durationMinutes: Number(durationMinutes) || 60,
      exercises,
      energyLevel: Number(energyLevel) || 3,
      notes
    });

    return res.status(201).json({ success: true, log });
  } catch (err) {
    next(err);
  }
}

export async function getWeightLogs(req, res, next) {
  try {
    const logs = await WeightLog.find({ userId: req.user.id }).sort({ date: 1 });
    const settings = await Setting.findOne({ userId: req.user.id }) || { startingWeightKg: 88, targetWeightKg: 73 };
    
    const latest = logs.length > 0 ? logs[logs.length - 1].weightKg : settings.startingWeightKg;
    const totalToLose = settings.startingWeightKg - settings.targetWeightKg; // 15 kg
    const lostSoFar = Math.max(0, settings.startingWeightKg - latest);
    const progressPercent = totalToLose > 0 ? Math.min(100, Math.round((lostSoFar / totalToLose) * 100)) : 0;

    return res.json({
      success: true,
      startingWeightKg: settings.startingWeightKg,
      targetWeightKg: settings.targetWeightKg,
      currentWeightKg: latest,
      lostSoFarKg: Math.round(lostSoFar * 10) / 10,
      remainingToTargetKg: Math.max(0, Math.round((latest - settings.targetWeightKg) * 10) / 10),
      progressPercent,
      logs
    });
  } catch (err) {
    next(err);
  }
}

export async function recordWeightLog(req, res, next) {
  try {
    const { date, weightKg, notes = '' } = req.body;
    if (!date || !weightKg) {
      return res.status(400).json({ success: false, error: 'Date and weight are required.' });
    }

    const log = await WeightLog.findOneAndUpdate(
      { userId: req.user.id, date },
      { $set: { weightKg: Number(weightKg), notes } },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, log });
  } catch (err) {
    next(err);
  }
}

// --- HABITS & ROUTINES ---
export async function getHabits(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const habits = await Habit.find({ userId: req.user.id, isActive: true });
    const logs = await HabitLog.find({ userId: req.user.id, date });

    const habitStatuses = habits.map(h => {
      const log = logs.find(l => l.habitId.toString() === h._id.toString());
      return {
        ...h.toObject(),
        isCompletedToday: Boolean(log && log.completed)
      };
    });

    return res.json({ success: true, date, habits: habitStatuses });
  } catch (err) {
    next(err);
  }
}

export async function toggleHabitCheckin(req, res, next) {
  try {
    const { habitId, date, completed = true, notes = '' } = req.body;
    if (!habitId || !date) {
      return res.status(400).json({ success: false, error: 'habitId and date are required.' });
    }

    const log = await HabitLog.findOneAndUpdate(
      { userId: req.user.id, habitId, date },
      { $set: { completed: Boolean(completed), notes } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
}

// --- NOTES & JOURNAL & RESET ROOM ---
export async function getNotes(req, res, next) {
  try {
    const { type, tag, q } = req.query;
    const filter = { userId: req.user.id };
    if (type) filter.type = type;
    if (tag) filter.tags = tag;
    if (q) {
      filter.$text = { $search: q };
    }

    const notes = await Note.find(filter).sort({ isPinned: -1, createdAt: -1 });
    return res.json({ success: true, count: notes.length, notes });
  } catch (err) {
    next(err);
  }
}

export async function createNote(req, res, next) {
  try {
    const { title, content, type = 'note', tags = [], mood = 'neutral', nextSingleAction = '' } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Note title is required.' });
    }

    const note = await Note.create({
      userId: req.user.id,
      title: title.trim(),
      content: content || '',
      type,
      date: new Date().toISOString().split('T')[0],
      tags: Array.isArray(tags) ? tags : [tags],
      mood,
      nextSingleAction
    });

    return res.status(201).json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

export async function updateNote(req, res, next) {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updatedAt: new Date() };
    delete updates.userId;

    const note = await Note.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: updates },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found.' });
    }

    return res.json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

// --- BUSINESS READING ---
export async function getReadingLogs(req, res, next) {
  try {
    const logs = await ReadingLog.find({ userId: req.user.id }).sort({ date: -1 });
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
}

export async function createReadingLog(req, res, next) {
  try {
    const { bookTitle, author = '', date, startPage = 0, endPage = 0, durationMinutes = 35, keyTakeaways = '', practicalApplication = '' } = req.body;
    if (!bookTitle || !date) {
      return res.status(400).json({ success: false, error: 'Book title and date are required.' });
    }

    const pages = Math.max(0, Number(endPage) - Number(startPage));

    const log = await ReadingLog.create({
      userId: req.user.id,
      bookTitle: bookTitle.trim(),
      author: author.trim(),
      date,
      startPage: Number(startPage) || 0,
      endPage: Number(endPage) || 0,
      pagesRead: pages,
      durationMinutes: Number(durationMinutes) || 35,
      keyTakeaways,
      practicalApplication
    });

    return res.status(201).json({ success: true, log });
  } catch (err) {
    next(err);
  }
}

// --- SHARE MARKET EDUCATION ---
export async function getMarketConcepts(req, res, next) {
  try {
    let concepts = await MarketConcept.find({ userId: req.user.id });
    if (concepts.length === 0) {
      const defaultConcepts = [
        {
          userId: req.user.id,
          title: 'Risk-to-Reward Ratio & Position Sizing',
          category: 'risk-management',
          notes: 'Never risk more than 1-2% of total capital on a single paper exercise. Calculate stop-loss before calculating profit potential.',
          keyRule: 'Capital protection comes before profit generation.'
        },
        {
          userId: req.user.id,
          title: 'Support, Resistance & Breakouts',
          category: 'technical-analysis',
          notes: 'Support is a price level where demand is strong enough to prevent the price from falling further. Wait for volume confirmation on breakouts.',
          keyRule: 'Trade what you see, not what you hope.'
        },
        {
          userId: req.user.id,
          title: 'Reading P&L and Balance Sheets (ROC, ROE, Debt/Equity)',
          category: 'fundamental-analysis',
          notes: 'Understand competitive moat, cash flows, and management track record. Avoid companies with high unhedged debt.',
          keyRule: 'Cash flow never lies.'
        }
      ];
      concepts = await MarketConcept.insertMany(defaultConcepts);
    }
    return res.json({ success: true, count: concepts.length, concepts });
  } catch (err) {
    next(err);
  }
}

export async function addPaperLog(req, res, next) {
  try {
    const { conceptId } = req.params;
    const { date, symbol, hypothesis, entryPrice, targetPrice, stopLossPrice, outcome = 'active', lessonLearned = '' } = req.body;

    const concept = await MarketConcept.findOne({ _id: conceptId, userId: req.user.id });
    if (!concept) {
      return res.status(404).json({ success: false, error: 'Market concept not found.' });
    }

    concept.paperLogs.push({
      date,
      symbol: symbol.toUpperCase(),
      hypothesis,
      entryPrice: Number(entryPrice),
      targetPrice: Number(targetPrice),
      stopLossPrice: Number(stopLossPrice),
      outcome,
      lessonLearned
    });

    await concept.save();

    return res.json({ success: true, concept });
  } catch (err) {
    next(err);
  }
}

// --- REWARDS & SAVINGS ---
export async function getRewardsAndSavings(req, res, next) {
  try {
    const rewards = await Reward.find({ userId: req.user.id });
    let savings = await SavingsEntry.findOne({ userId: req.user.id });
    if (!savings) {
      savings = await SavingsEntry.create({
        userId: req.user.id,
        goalTitle: 'Mountain Trekking / 20th Birthday Celebration (₹4,000)',
        targetAmount: 4000,
        contributions: []
      });
    }

    return res.json({
      success: true,
      savings,
      rewards
    });
  } catch (err) {
    next(err);
  }
}

export async function addSavingsContribution(req, res, next) {
  try {
    const { amount, date = new Date().toISOString().split('T')[0], note = '', source = 'personal-savings' } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid contribution amount is required.' });
    }

    let savings = await SavingsEntry.findOne({ userId: req.user.id });
    if (!savings) {
      savings = new SavingsEntry({ userId: req.user.id, targetAmount: 4000, contributions: [] });
    }

    savings.contributions.push({
      date,
      amount: Number(amount),
      note,
      source
    });

    await savings.save();

    return res.json({ success: true, savings });
  } catch (err) {
    next(err);
  }
}
