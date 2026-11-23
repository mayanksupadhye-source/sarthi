import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { FitnessLog } from "../models/FitnessLog.js";
import { WeightLog } from "../models/WeightLog.js";
import { Habit } from "../models/Habit.js";
import { HabitLog } from "../models/HabitLog.js";
import { Note } from "../models/Note.js";
import { ReadingLog } from "../models/ReadingLog.js";
import { MarketConcept } from "../models/MarketConcept.js";
import { Reward, SavingsEntry } from "../models/Reward.js";
import { SavingsDeposit } from "../models/SavingsDeposit.js";
import { SavingsAccount } from "../models/SavingsAccount.js";
import { Task } from "../models/Task.js";
import { Setting } from "../models/Setting.js";
import {
  dateRangeForExecution,
  getExecutionChallengeProgress,
  localDayKey,
  shiftDateKey,
} from "../services/executionRewardProgress.js";
import { getWeeklyFitnessQuote } from "../services/fitnessQuotes.js";

const SAVINGS_TARGET_INR = 5000;
const WEIGHT_START_KG = 90;
const WEIGHT_TARGET_KG = 73;
const FRIENDS_TREAT_UNLOCK_KG = 85.5;
const REWARD_DEFINITIONS = [
  {
    category: "movie",
    title: "Marvel Movie Night",
    description:
      "A free movie night earned through a two-week execution challenge.",
    unlockCriteria:
      "Complete at least one task on each of 14 consecutive calendar days, plus complete at least 85% of planned tasks on five calendar days within that streak.",
    priceINR: 0,
  },
  {
    category: "trekking",
    title: "Mountain Trekking Expedition",
    description: "Celebrate your 20th birthday with a mountain trek.",
    unlockCriteria:
      "Complete the ₹5,000 savings goal using confirmed piggy-bank deposits.",
    priceINR: SAVINGS_TARGET_INR,
    goalAmount: SAVINGS_TARGET_INR,
  },
  {
    category: "friends",
    title: "Favorite Treat with Friends",
    description: "Enjoy your favorite treat with friends on Sunday evening.",
    unlockCriteria:
      "Save a weight check-in at or below 85.5 kg from the 90 kg starting baseline. Enjoy it on Sunday evening.",
    priceINR: 0,
    unlockWeightKg: FRIENDS_TREAT_UNLOCK_KG,
  },
];

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

function parseDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
      ? null
      : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function ensureRewardCatalog(userId, session) {
  const rewards = [];
  for (const definition of REWARD_DEFINITIONS) {
    let query = Reward.findOne({ userId, category: definition.category }).sort({
      createdAt: 1,
    });
    if (session) query = query.session(session);
    let reward = await query;
    if (!reward) {
      const [created] = await Reward.create(
        [
          {
            userId,
            ...definition,
            isUnlocked: false,
            isRedeemed: false,
          },
        ],
        session ? { session } : {},
      );
      reward = created;
    } else {
      Object.assign(reward, definition);
      await reward.save(session ? { session } : undefined);
    }
    rewards.push(reward);
  }
  return rewards;
}

async function unlockReward(reward, eligible, session) {
  if (!eligible || reward.isUnlocked) return null;
  reward.isUnlocked = true;
  reward.unlockedAt = new Date();
  await reward.save(session ? { session } : undefined);
  return { id: reward._id, category: reward.category, title: reward.title };
}

async function migrateLegacyDeposits(userId, account, savings, session) {
  const depositsQuery = SavingsDeposit.find({ userId })
    .sort({ serialNumber: -1 })
    .limit(1);
  if (session) depositsQuery.session(session);
  const highestDeposit = await depositsQuery;
  let nextNumber = Math.max(
    Number(account.lastDepositNumber) || 0,
    Number(highestDeposit[0]?.serialNumber) || 0,
  );
  for (const [savingsIndex, savingsEntry] of savings.entries()) {
    const contributions = savingsEntry.contributions || [];
    for (let index = 0; index < contributions.length; index += 1) {
      const contribution = contributions[index];
      const legacyId = String(
        contribution._id ||
          `legacy-${savingsIndex}-${index}-${contribution.date}-${contribution.amount}`,
      );
      let lookup = SavingsDeposit.exists({
        userId,
        legacyContributionId: legacyId,
      });
      if (session) lookup = lookup.session(session);
      if (await lookup) continue;

      const dateKey = parseDateKey(contribution.date);
      const amount = Number(contribution.amount);
      if (!dateKey || !Number.isFinite(amount) || amount <= 0) continue;
      nextNumber += 1;
      await SavingsDeposit.create(
        [
          {
            userId,
            serialNumber: nextNumber,
            date: new Date(`${dateKey}T00:00:00.000Z`),
            dateKey,
            message: String(contribution.note || "").slice(0, 50),
            amount,
            source: contribution.source || "personal-savings",
            legacyContributionId: legacyId,
          },
        ],
        session ? { session } : {},
      );
    }
    savingsEntry.targetAmount = SAVINGS_TARGET_INR;
    savingsEntry.goalTitle =
      "Mountain Trekking Expedition Savings Goal (₹5,000)";
    await savingsEntry.save(session ? { session } : undefined);
  }
  if (account.lastDepositNumber !== nextNumber)
    account.lastDepositNumber = nextNumber;
  account.targetAmount = SAVINGS_TARGET_INR;
  if (!account.legacyMigratedAt) account.legacyMigratedAt = new Date();
  if (session) await account.save({ session });
  else await account.save();

  return account;
}

async function ensureSavingsRecords(userId, session) {
  let accountQuery = SavingsAccount.findOne({ userId });
  let savingsQuery = SavingsEntry.find({ userId }).sort({ createdAt: 1 });
  if (session) {
    accountQuery = accountQuery.session(session);
    savingsQuery = savingsQuery.session(session);
  }
  let account = await accountQuery;
  let savingsEntries = await savingsQuery;
  if (!account) {
    const [created] = await SavingsAccount.create(
      [{ userId, targetAmount: SAVINGS_TARGET_INR }],
      session ? { session } : {},
    );
    account = created;
  }
  if (!savingsEntries.length) {
    const [created] = await SavingsEntry.create(
      [
        {
          userId,
          goalTitle: "Mountain Trekking Expedition Savings Goal (₹5,000)",
          targetAmount: SAVINGS_TARGET_INR,
          contributions: [],
        },
      ],
      session ? { session } : {},
    );
    savingsEntries = [created];
  }
  await migrateLegacyDeposits(userId, account, savingsEntries, session);
  return { account, savings: savingsEntries[0] };
}

async function savingsSnapshot(userId, account, deposits, session) {
  const totalSaved = deposits.reduce(
    (total, deposit) => total + Number(deposit.amount || 0),
    0,
  );
  const targetAmount = SAVINGS_TARGET_INR;
  return {
    targetAmount,
    goalTitle: "Mountain Trekking Expedition Savings Goal (₹5,000)",
    totalSaved,
    remainingAmount: Math.max(0, targetAmount - totalSaved),
    progressPercent: Math.min(
      100,
      Math.round((totalSaved / targetAmount) * 100),
    ),
    depositCount: deposits.length,
    lastDepositNumber: account.lastDepositNumber,
    nextDepositNumber: account.lastDepositNumber + 1,
    goalCompletedAt: account.goalCompletedAt,
    mostRecentDeposit: deposits[0] || null,
    deposits,
    contributions: deposits,
  };
}

async function ensureFitnessSettings(userId, session) {
  let query = Setting.findOne({ userId });
  if (session) query = query.session(session);
  let setting = await query;
  if (!setting) {
    const [created] = await Setting.create(
      [
        {
          userId,
          startingWeightKg: WEIGHT_START_KG,
          targetWeightKg: WEIGHT_TARGET_KG,
          savingsTargetAmount: SAVINGS_TARGET_INR,
        },
      ],
      session ? { session } : {},
    );
    setting = created;
  }
  if (setting.startingWeightKg === 88)
    setting.startingWeightKg = WEIGHT_START_KG;
  if (setting.targetWeightKg !== WEIGHT_TARGET_KG)
    setting.targetWeightKg = WEIGHT_TARGET_KG;
  if (setting.savingsTargetAmount === 4000)
    setting.savingsTargetAmount = SAVINGS_TARGET_INR;
  return setting;
}

async function migrateWeightLogs(userId, session) {
  let query = WeightLog.find({ userId }).sort({ date: 1, createdAt: 1 });
  if (session) query = query.session(session);
  const logs = await query;
  let sequence = Math.max(
    0,
    ...logs.map((log) => Number(log.checkInNumber) || 0),
  );
  for (const log of logs) {
    const dateKey = parseDateKey(log.date);
    if (dateKey && !log.measurementDate)
      log.measurementDate = new Date(`${dateKey}T00:00:00.000Z`);
    if (!log.checkInNumber) {
      sequence += 1;
      log.checkInNumber = sequence;
    }
    if (log.isModified()) await log.save(session ? { session } : undefined);
  }
  const setting = await ensureFitnessSettings(userId, session);
  if ((setting.weightCheckInSequence || 0) < sequence)
    setting.weightCheckInSequence = sequence;
  if (setting.isModified())
    await setting.save(session ? { session } : undefined);
  return { logs, setting, sequence };
}

function getWeightMetrics(logs, setting) {
  const startingWeightKg = WEIGHT_START_KG;
  const targetWeightKg = WEIGHT_TARGET_KG;
  const currentWeightKg = logs.length
    ? Number(logs.at(-1).weightKg)
    : startingWeightKg;
  const totalToLoseKg = startingWeightKg - targetWeightKg;
  const lostSoFarKg = Math.max(0, startingWeightKg - currentWeightKg);
  return {
    startingWeightKg,
    targetWeightKg,
    totalToLoseKg,
    currentWeightKg,
    lostSoFarKg: Math.round(lostSoFarKg * 10) / 10,
    remainingToTargetKg: Math.max(
      0,
      Math.round((currentWeightKg - targetWeightKg) * 10) / 10,
    ),
    progressPercent: Math.min(
      100,
      Math.max(0, Math.round((lostSoFarKg / totalToLoseKg) * 100)),
    ),
    nextCheckInNumber: (setting.weightCheckInSequence || 0) + 1,
    nextEligibleDate: logs.length
      ? shiftDateKey(parseDateKey(logs.at(-1).date), 14)
      : localDayKey(new Date()),
  };
}

async function getMovieExecutionProgress(userId, session) {
  const { firstDay, start, end } = dateRangeForExecution();
  let query = Task.find({
    userId,
    $or: [
      { scheduledDate: { $gte: firstDay, $lte: localDayKey(new Date()) } },
      { status: "completed", completedAt: { $gte: start, $lt: end } },
    ],
  }).select("_id title scheduledDate status completedAt");
  if (session) query = query.session(session);
  return getExecutionChallengeProgress(await query, localDayKey(new Date()));
}

async function evaluateRewardStates(
  userId,
  { account, deposits, weightLogs, session },
) {
  const rewards = await ensureRewardCatalog(userId, session);
  const newlyUnlockedRewards = [];
  const totalSaved = deposits.reduce(
    (sum, deposit) => sum + Number(deposit.amount || 0),
    0,
  );
  if (totalSaved >= SAVINGS_TARGET_INR) {
    const mountain = rewards.find((reward) => reward.category === "trekking");
    const transition = await unlockReward(mountain, true, session);
    if (transition) newlyUnlockedRewards.push(transition);
    if (!account.goalCompletedAt) {
      account.goalCompletedAt = new Date();
      if (session) await account.save({ session });
      else await account.save();
    }
  }

  const executionProgress = await getMovieExecutionProgress(userId, session);
  const movie = rewards.find((reward) => reward.category === "movie");
  const movieTransition = await unlockReward(
    movie,
    executionProgress.unlocked,
    session,
  );
  if (movieTransition) newlyUnlockedRewards.push(movieTransition);

  const reachedTreatWeight = weightLogs.some(
    (log) => Number(log.weightKg) <= FRIENDS_TREAT_UNLOCK_KG,
  );
  const friends = rewards.find((reward) => reward.category === "friends");
  const friendsTransition = await unlockReward(
    friends,
    reachedTreatWeight,
    session,
  );
  if (friendsTransition) newlyUnlockedRewards.push(friendsTransition);
  return { rewards, newlyUnlockedRewards, executionProgress };
}

function formatWeightHistory(logs) {
  return logs.map((log, index) => ({
    ...log.toObject(),
    dateKey: parseDateKey(log.date),
    changeFromPreviousKg:
      index === 0
        ? null
        : Math.round((log.weightKg - logs[index - 1].weightKg) * 10) / 10,
  }));
}

// --- FITNESS & WEIGHT ---
export async function getFitnessLogs(req, res, next) {
  try {
    const logs = await FitnessLog.find({ userId: req.user.id })
      .sort({ date: -1 })
      .limit(30);
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
}

export async function createFitnessLog(req, res, next) {
  try {
    const {
      date,
      workoutType,
      durationMinutes = 60,
      exercises = [],
      energyLevel = 3,
      notes = "",
    } = req.body;
    if (!date || !workoutType) {
      return res
        .status(400)
        .json({ success: false, error: "Date and workout type are required." });
    }

    const log = await FitnessLog.create({
      userId: req.user.id,
      date,
      workoutType,
      durationMinutes: Number(durationMinutes) || 60,
      exercises,
      energyLevel: Number(energyLevel) || 3,
      notes,
    });

    return res.status(201).json({ success: true, log });
  } catch (err) {
    next(err);
  }
}

export async function getWeightLogs(req, res, next) {
  try {
    const data = await runInTransaction(async (session) => {
      const { logs, setting } = await migrateWeightLogs(req.user.id, session);
      const rewards = await ensureRewardCatalog(req.user.id, session);
      const friendReward = rewards.find(
        (reward) => reward.category === "friends",
      );
      const transition = await unlockReward(
        friendReward,
        logs.some((log) => Number(log.weightKg) <= FRIENDS_TREAT_UNLOCK_KG),
        session,
      );
      return {
        metrics: getWeightMetrics(logs, setting),
        logs: formatWeightHistory(logs),
        newlyUnlockedRewards: transition ? [transition] : [],
      };
    });
    return res.json({
      success: true,
      ...data.metrics,
      logs: data.logs,
      newlyUnlockedRewards: data.newlyUnlockedRewards,
    });
  } catch (err) {
    next(err);
  }
}

export async function recordWeightLog(req, res, next) {
  try {
    const dateKey = parseDateKey(req.body.date);
    const weightKg = Number(req.body.weightKg);
    const notes =
      typeof req.body.notes === "string" ? req.body.notes.trim() : "";
    if (!dateKey)
      return res
        .status(400)
        .json({ success: false, error: "Enter a valid check-in date." });
    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 200) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Weight must be between 30 and 200 kg.",
        });
    }
    if (dateKey > localDayKey(new Date()))
      return res
        .status(400)
        .json({
          success: false,
          error: "A weight check-in cannot be dated in the future.",
        });

    const result = await runInTransaction(async (session) => {
      const { logs, setting } = await migrateWeightLogs(req.user.id, session);
      if (logs.some((log) => parseDateKey(log.date) === dateKey)) {
        return {
          error: "A check-in is already saved for that date.",
          status: 409,
        };
      }
      if (!logs.length && weightKg !== WEIGHT_START_KG) {
        return {
          error: "Your first check-in establishes the 90 kg starting baseline.",
          status: 400,
        };
      }
      const latest = logs.at(-1);
      const nextEligibleDate = latest
        ? shiftDateKey(parseDateKey(latest.date), 14)
        : dateKey;
      if (latest && dateKey < nextEligibleDate) {
        return {
          error: `The next check-in is due on or after ${nextEligibleDate}.`,
          status: 400,
          nextEligibleDate,
        };
      }

      const checkInNumber =
        Math.max(
          Number(setting.weightCheckInSequence) || 0,
          ...logs.map((log) => Number(log.checkInNumber) || 0),
        ) + 1;
      setting.weightCheckInSequence = checkInNumber;
      await setting.save({ session });
      const [log] = await WeightLog.create(
        [
          {
            userId: req.user.id,
            checkInNumber,
            date: dateKey,
            measurementDate: new Date(`${dateKey}T00:00:00.000Z`),
            weightKg,
            notes,
          },
        ],
        { session },
      );
      const allLogs = [...logs, log].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const rewards = await ensureRewardCatalog(req.user.id, session);
      const friendReward = rewards.find(
        (reward) => reward.category === "friends",
      );
      const transition = await unlockReward(
        friendReward,
        allLogs.some(
          (entry) => Number(entry.weightKg) <= FRIENDS_TREAT_UNLOCK_KG,
        ),
        session,
      );
      return {
        log: formatWeightHistory(allLogs).at(-1),
        metrics: getWeightMetrics(allLogs, setting),
        newlyUnlockedRewards: transition ? [transition] : [],
      };
    });
    if (result.error)
      return res
        .status(result.status)
        .json({
          success: false,
          error: result.error,
          nextEligibleDate: result.nextEligibleDate,
        });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err?.code === 11000)
      return res
        .status(409)
        .json({
          success: false,
          error: "That check-in or serial number is already recorded.",
        });
    next(err);
  }
}

export async function getFitnessQuote(req, res) {
  return res.json({ success: true, ...getWeeklyFitnessQuote() });
}

// --- HABITS & ROUTINES ---
export async function getHabits(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    await ensureNightRoutine(req.user.id);
    const habits = await Habit.find({ userId: req.user.id, isActive: true });
    const logs = await HabitLog.find({ userId: req.user.id, date });

    const habitStatuses = habits.map((h) => {
      const log = logs.find((l) => l.habitId.toString() === h._id.toString());
      return {
        ...h.toObject(),
        isCompletedToday: Boolean(log && log.completed),
      };
    });

    return res.json({ success: true, date, habits: habitStatuses });
  } catch (err) {
    next(err);
  }
}

const NIGHT_ROUTINE = [
  {
    title: "No phone before sleep",
    aliases: ["No phone during night routine"],
    durationMinutes: null,
    routineGroup: "whole-routine",
    groupDurationMinutes: null,
    isTrackable: true,
  },
  {
    title: "Learn five new English words",
    aliases: ["Learn 5 new English words"],
    durationMinutes: 5,
    routineGroup: "vocabulary",
    groupDurationMinutes: 5,
    isTrackable: true,
  },
  {
    title: "Brush teeth",
    aliases: [],
    durationMinutes: null,
    routineGroup: "hygiene",
    groupDurationMinutes: 5,
    isTrackable: true,
  },
  {
    title: "Wash face",
    aliases: [],
    durationMinutes: null,
    routineGroup: "hygiene",
    groupDurationMinutes: 5,
    isTrackable: true,
  },
  {
    title: "Apply niacinamide serum",
    aliases: [],
    durationMinutes: null,
    routineGroup: "hygiene",
    groupDurationMinutes: 5,
    isTrackable: true,
  },
  {
    title: "Meditation — 15 minutes",
    aliases: ["15-min Meditation & Mindful Breathing"],
    durationMinutes: null,
    routineGroup: "meditation-breathing",
    groupDurationMinutes: 15,
    isTrackable: true,
  },
  {
    title: "Five pranayams",
    aliases: [],
    durationMinutes: null,
    routineGroup: "meditation-breathing",
    groupDurationMinutes: 15,
    isTrackable: true,
  },
  {
    title: "Book reading — 35 minutes",
    aliases: ["Business reading (SPIN Selling / Influence)"],
    durationMinutes: 35,
    routineGroup: "reading",
    groupDurationMinutes: 35,
    isTrackable: true,
  },
  {
    title: "Journaling — 10 minutes",
    aliases: ["10-min Journal & Daily Reflection"],
    durationMinutes: 10,
    routineGroup: "journaling",
    groupDurationMinutes: 10,
    isTrackable: true,
  },
];

async function ensureNightRoutine(userId) {
  for (const step of NIGHT_ROUTINE) {
    let habit = await Habit.findOne({
      userId,
      title: { $in: [step.title, ...step.aliases] },
    });
    if (!habit) {
      habit = await Habit.create({
        userId,
        title: step.title,
        category: "night-routine",
        timeOfDay: "night",
        frequency: "daily",
        isTrackable: true,
      });
    } else if (habit.title !== step.title) {
      habit.title = step.title;
    }
    habit.category = "night-routine";
    habit.timeOfDay = "night";
    habit.frequency = "daily";
    habit.durationMinutes = step.durationMinutes;
    habit.routineGroup = step.routineGroup;
    habit.groupDurationMinutes = step.groupDurationMinutes;
    if (habit.isTrackable === undefined || habit.isTrackable === null)
      habit.isTrackable = step.isTrackable;
    await habit.save();
  }
}

export async function toggleHabitCheckin(req, res, next) {
  try {
    const { habitId, date, completed = true, notes = "" } = req.body;
    if (!habitId || !date) {
      return res
        .status(400)
        .json({ success: false, error: "habitId and date are required." });
    }

    const log = await HabitLog.findOneAndUpdate(
      { userId: req.user.id, habitId, date },
      { $set: { completed: Boolean(completed), notes } },
      { upsert: true, new: true },
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
    const {
      title,
      content,
      type = "note",
      tags = [],
      mood = "neutral",
      nextSingleAction = "",
    } = req.body;
    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Note title is required." });
    }

    const note = await Note.create({
      userId: req.user.id,
      title: title.trim(),
      content: content || "",
      type,
      date: new Date().toISOString().split("T")[0],
      tags: Array.isArray(tags) ? tags : [tags],
      mood,
      nextSingleAction,
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
      { new: true },
    );

    if (!note) {
      return res.status(404).json({ success: false, error: "Note not found." });
    }

    return res.json({ success: true, note });
  } catch (err) {
    next(err);
  }
}

// --- BUSINESS READING ---
export async function getReadingLogs(req, res, next) {
  try {
    const logs = await ReadingLog.find({ userId: req.user.id }).sort({
      date: -1,
    });
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
}

export async function createReadingLog(req, res, next) {
  try {
    const {
      bookTitle,
      author = "",
      date,
      startPage = 0,
      endPage = 0,
      durationMinutes = 35,
      keyTakeaways = "",
      practicalApplication = "",
    } = req.body;
    if (!bookTitle || !date) {
      return res
        .status(400)
        .json({ success: false, error: "Book title and date are required." });
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
      practicalApplication,
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
          title: "Risk-to-Reward Ratio & Position Sizing",
          category: "risk-management",
          notes:
            "Never risk more than 1-2% of total capital on a single paper exercise. Calculate stop-loss before calculating profit potential.",
          keyRule: "Capital protection comes before profit generation.",
        },
        {
          userId: req.user.id,
          title: "Support, Resistance & Breakouts",
          category: "technical-analysis",
          notes:
            "Support is a price level where demand is strong enough to prevent the price from falling further. Wait for volume confirmation on breakouts.",
          keyRule: "Trade what you see, not what you hope.",
        },
        {
          userId: req.user.id,
          title: "Reading P&L and Balance Sheets (ROC, ROE, Debt/Equity)",
          category: "fundamental-analysis",
          notes:
            "Understand competitive moat, cash flows, and management track record. Avoid companies with high unhedged debt.",
          keyRule: "Cash flow never lies.",
        },
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
    const {
      date,
      symbol,
      hypothesis,
      entryPrice,
      targetPrice,
      stopLossPrice,
      outcome = "active",
      lessonLearned = "",
    } = req.body;

    const concept = await MarketConcept.findOne({
      _id: conceptId,
      userId: req.user.id,
    });
    if (!concept) {
      return res
        .status(404)
        .json({ success: false, error: "Market concept not found." });
    }

    concept.paperLogs.push({
      date,
      symbol: symbol.toUpperCase(),
      hypothesis,
      entryPrice: Number(entryPrice),
      targetPrice: Number(targetPrice),
      stopLossPrice: Number(stopLossPrice),
      outcome,
      lessonLearned,
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
    const data = await runInTransaction(async (session) => {
      const { account } = await ensureSavingsRecords(req.user.id, session);
      const { logs, setting } = await migrateWeightLogs(req.user.id, session);
      const deposits = await SavingsDeposit.find({ userId: req.user.id })
        .sort({ date: -1, serialNumber: -1 })
        .session(session);
      const rewardState = await evaluateRewardStates(req.user.id, {
        account,
        deposits,
        weightLogs: logs,
        session,
      });
      const savings = await savingsSnapshot(
        req.user.id,
        account,
        deposits,
        session,
      );
      return {
        savings,
        rewards: rewardState.rewards,
        executionProgress: rewardState.executionProgress,
        weightSummary: getWeightMetrics(logs, setting),
        newlyUnlockedRewards: rewardState.newlyUnlockedRewards,
      };
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function addSavingsContribution(req, res, next) {
  try {
    const amount = Number(req.body.amount);
    const dateKey = parseDateKey(req.body.date || localDayKey(new Date()));
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    const source =
      typeof req.body.source === "string" && req.body.source
        ? req.body.source
        : "personal-savings";
    const submissionKey =
      typeof req.body.submissionKey === "string" &&
      req.body.submissionKey.length <= 100
        ? req.body.submissionKey
        : randomUUID();
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Deposit amount must be greater than ₹0.",
        });
    }
    if (!dateKey)
      return res
        .status(400)
        .json({ success: false, error: "Choose a valid deposit date." });
    if (dateKey > localDayKey(new Date()))
      return res
        .status(400)
        .json({
          success: false,
          error: "Deposit date cannot be in the future.",
        });
    if (message.length > 50)
      return res
        .status(400)
        .json({
          success: false,
          error: "Deposit message must be 50 characters or fewer.",
        });

    const result = await runInTransaction(async (session) => {
      const { account } = await ensureSavingsRecords(req.user.id, session);
      let deposit = await SavingsDeposit.findOne({
        userId: req.user.id,
        submissionKey,
      }).session(session);
      const duplicateSubmission = Boolean(deposit);
      if (!deposit) {
        account.lastDepositNumber += 1;
        await account.save({ session });
        const [created] = await SavingsDeposit.create(
          [
            {
              userId: req.user.id,
              serialNumber: account.lastDepositNumber,
              date: new Date(`${dateKey}T00:00:00.000Z`),
              dateKey,
              message,
              amount,
              source,
              submissionKey,
            },
          ],
          { session },
        );
        deposit = created;
      }

      const { logs, setting } = await migrateWeightLogs(req.user.id, session);
      const deposits = await SavingsDeposit.find({ userId: req.user.id })
        .sort({ date: -1, serialNumber: -1 })
        .session(session);
      const rewardState = await evaluateRewardStates(req.user.id, {
        account,
        deposits,
        weightLogs: logs,
        session,
      });
      const savings = await savingsSnapshot(
        req.user.id,
        account,
        deposits,
        session,
      );
      return {
        deposit,
        savings,
        rewards: rewardState.rewards,
        executionProgress: rewardState.executionProgress,
        weightSummary: getWeightMetrics(logs, setting),
        newlyUnlockedRewards: duplicateSubmission
          ? []
          : rewardState.newlyUnlockedRewards,
        duplicateSubmission,
      };
    });

    return res
      .status(result.duplicateSubmission ? 200 : 201)
      .json({ success: true, ...result });
  } catch (err) {
    if (err?.code === 11000)
      return res
        .status(409)
        .json({
          success: false,
          error:
            "This deposit was already submitted. Refresh savings history to see its saved serial number.",
        });
    next(err);
  }
}
