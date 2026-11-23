import { CycleProfile } from "../models/CycleProfile.js";
import { PeriodRecord } from "../models/PeriodRecord.js";
import { DailyCycleLog } from "../models/DailyCycleLog.js";
import { CyclePrediction } from "../models/CyclePrediction.js";
import { config } from "../config/env.js";
import {
  addDays,
  calculateCycleIntelligence,
  dateInTimezone,
  differenceInDays,
  getCalendarDay,
  isDateOnly,
} from "../services/cycleEngine.js";

const BASELINE_START = "2026-10-23";
const MOODS = new Set([
  "happy",
  "calm",
  "energized",
  "neutral",
  "low",
  "frustrated",
  "anxious",
  "sad",
  "other",
]);

async function ensureProfile(userId) {
  const profile = await CycleProfile.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        displayName: "Rashi",
        cycleLengthEstimateDays: 28,
        cycleLengthPreferenceDays: 28,
        periodLengthEstimateDays: 5,
        timezone: config.timezone,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await PeriodRecord.findOneAndUpdate(
    { userId, profileId: profile._id, actualPeriodStartDate: BASELINE_START },
    {
      $setOnInsert: {
        userId,
        profileId: profile._id,
        actualPeriodStartDate: BASELINE_START,
        recordType: "actual",
        notes: "Initial actual period date",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return profile;
}

async function getRecords(profile) {
  return PeriodRecord.find({
    userId: profile.userId,
    profileId: profile._id,
  }).sort({ actualPeriodStartDate: 1 });
}

async function calculateAndPersist(profile, records, asOfDate) {
  const intelligence = calculateCycleIntelligence({
    records,
    cycleLengthPreference: profile.cycleLengthPreferenceDays,
    periodLength: profile.periodLengthEstimateDays,
    asOfDate,
  });
  profile.cycleLengthEstimateDays = intelligence.cycleLength;
  await profile.save();

  if (intelligence.prediction) {
    const latest = records[records.length - 1];
    await CyclePrediction.findOneAndUpdate(
      { userId: profile.userId, profileId: profile._id },
      {
        $set: {
          ...intelligence.prediction,
          userId: profile.userId,
          profileId: profile._id,
          generatedForDate: asOfDate,
          generatedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    intelligence.prediction.basedOnPeriodRecordId = latest._id;
  } else {
    await CyclePrediction.deleteOne({
      userId: profile.userId,
      profileId: profile._id,
    });
  }
  return intelligence;
}

function historyWithIntervals(records) {
  return records.map((record, index) => {
    const value = record.toObject ? record.toObject() : record;
    return {
      ...value,
      cycleIntervalDays: index
        ? differenceInDays(
            records[index - 1].actualPeriodStartDate,
            record.actualPeriodStartDate,
          )
        : null,
    };
  });
}

function validatePeriodInput({ start, end, notes }) {
  if (!isDateOnly(start))
    return "A valid period start date in YYYY-MM-DD format is required.";
  if (end && !isDateOnly(end))
    return "Period end date must use YYYY-MM-DD format.";
  if (end && end < start)
    return "Period end date cannot be before its start date.";
  if (end && differenceInDays(start, end) > 10)
    return "Period duration must be 11 days or fewer.";
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 1000))
    return "Notes must be 1,000 characters or fewer.";
  return null;
}

function validationError(err) {
  if (err?.code === 11000)
    return {
      status: 409,
      message: "A period record already exists for that start date.",
    };
  if (err?.name === "ValidationError" || err?.name === "CastError")
    return { status: 400, message: err.message };
  return null;
}

export async function getCycleProfile(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const records = await getRecords(profile);
    const today = dateInTimezone(profile.timezone || config.timezone);
    const intelligence = await calculateAndPersist(profile, records, today);
    return res.json({
      success: true,
      asOfDate: today,
      profile,
      periodRecords: historyWithIntervals(records),
      intelligence,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCycleProfile(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const {
      displayName,
      cycleLengthPreferenceDays,
      periodLengthEstimateDays,
      timezone,
    } = req.body;
    const updates = {};
    if (displayName !== undefined) {
      if (
        typeof displayName !== "string" ||
        !displayName.trim() ||
        displayName.trim().length > 60
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Display name must be 1–60 characters.",
          });
      }
      updates.displayName = displayName.trim();
    }
    if (cycleLengthPreferenceDays !== undefined) {
      const value = Number(cycleLengthPreferenceDays);
      if (!Number.isInteger(value) || value < 15 || value > 60)
        return res
          .status(400)
          .json({
            success: false,
            error: "Cycle estimate must be between 15 and 60 days.",
          });
      updates.cycleLengthPreferenceDays = value;
    }
    if (periodLengthEstimateDays !== undefined) {
      const value = Number(periodLengthEstimateDays);
      if (!Number.isInteger(value) || value < 1 || value > 10)
        return res
          .status(400)
          .json({
            success: false,
            error: "Period length estimate must be between 1 and 10 days.",
          });
      updates.periodLengthEstimateDays = value;
    }
    if (timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
      } catch {
        return res
          .status(400)
          .json({ success: false, error: "Choose a valid timezone." });
      }
      updates.timezone = timezone;
    }
    Object.assign(profile, updates);
    await profile.save();
    const records = await getRecords(profile);
    const today = dateInTimezone(profile.timezone || config.timezone);
    const intelligence = await calculateAndPersist(profile, records, today);
    return res.json({
      success: true,
      asOfDate: today,
      profile,
      periodRecords: historyWithIntervals(records),
      intelligence,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCycleIntelligence(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const asOfDate =
      req.query.date || dateInTimezone(profile.timezone || config.timezone);
    if (!isDateOnly(asOfDate))
      return res
        .status(400)
        .json({ success: false, error: "date must use YYYY-MM-DD format." });
    const records = await getRecords(profile);
    const intelligence = await calculateAndPersist(profile, records, asOfDate);
    return res.json({
      success: true,
      asOfDate,
      profile,
      periodRecords: historyWithIntervals(records),
      intelligence,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPeriodRecords(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const records = await getRecords(profile);
    return res.json({
      success: true,
      count: records.length,
      periodRecords: historyWithIntervals(records),
    });
  } catch (err) {
    next(err);
  }
}

export async function createPeriodRecord(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const start = req.body.actualPeriodStartDate;
    const end = req.body.actualPeriodEndDate || null;
    const error = validatePeriodInput({ start, end, notes: req.body.notes });
    if (error) return res.status(400).json({ success: false, error });
    const today = dateInTimezone(profile.timezone || config.timezone);
    if (start > today || (end && end > today))
      return res
        .status(400)
        .json({
          success: false,
          error: "Actual period dates cannot be in the future.",
        });
    const record = await PeriodRecord.create({
      userId: req.user.id,
      profileId: profile._id,
      actualPeriodStartDate: start,
      actualPeriodEndDate: end,
      notes: req.body.notes || "",
      recordType: "actual",
    });
    const records = await getRecords(profile);
    const intelligence = await calculateAndPersist(profile, records, today);
    return res
      .status(201)
      .json({
        success: true,
        periodRecord: record,
        periodRecords: historyWithIntervals(records),
        profile,
        intelligence,
      });
  } catch (err) {
    const issue = validationError(err);
    if (issue)
      return res
        .status(issue.status)
        .json({ success: false, error: issue.message });
    next(err);
  }
}

export async function updatePeriodRecord(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const record = await PeriodRecord.findOne({
      _id: req.params.id,
      userId: req.user.id,
      profileId: profile._id,
    });
    if (!record)
      return res
        .status(404)
        .json({ success: false, error: "Actual period record not found." });
    const start =
      req.body.actualPeriodStartDate ?? record.actualPeriodStartDate;
    const end =
      req.body.actualPeriodEndDate === undefined
        ? record.actualPeriodEndDate
        : req.body.actualPeriodEndDate || null;
    const notes = req.body.notes ?? record.notes;
    const error = validatePeriodInput({ start, end, notes });
    if (error) return res.status(400).json({ success: false, error });
    const today = dateInTimezone(profile.timezone || config.timezone);
    if (start > today || (end && end > today))
      return res
        .status(400)
        .json({
          success: false,
          error: "Actual period dates cannot be in the future.",
        });
    const duplicate = await PeriodRecord.exists({
      _id: { $ne: record._id },
      userId: req.user.id,
      profileId: profile._id,
      actualPeriodStartDate: start,
    });
    if (duplicate)
      return res
        .status(409)
        .json({
          success: false,
          error: "A period record already exists for that start date.",
        });
    record.actualPeriodStartDate = start;
    record.actualPeriodEndDate = end;
    record.notes = notes;
    await record.save();
    const records = await getRecords(profile);
    const intelligence = await calculateAndPersist(profile, records, today);
    return res.json({
      success: true,
      periodRecord: record,
      periodRecords: historyWithIntervals(records),
      profile,
      intelligence,
    });
  } catch (err) {
    const issue = validationError(err);
    if (issue)
      return res
        .status(issue.status)
        .json({ success: false, error: issue.message });
    next(err);
  }
}

export async function deletePeriodRecord(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const record = await PeriodRecord.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
      profileId: profile._id,
    });
    if (!record)
      return res
        .status(404)
        .json({ success: false, error: "Actual period record not found." });
    const records = await getRecords(profile);
    const today = dateInTimezone(profile.timezone || config.timezone);
    const intelligence = await calculateAndPersist(profile, records, today);
    return res.json({
      success: true,
      message: "Actual period record removed and estimates recalculated.",
      periodRecords: historyWithIntervals(records),
      profile,
      intelligence,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCycleCalendar(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const month =
      req.query.month ||
      dateInTimezone(profile.timezone || config.timezone).slice(0, 7);
    if (
      !/^\d{4}-\d{2}$/.test(month) ||
      Number(month.slice(5)) < 1 ||
      Number(month.slice(5)) > 12
    ) {
      return res
        .status(400)
        .json({ success: false, error: "month must use YYYY-MM format." });
    }
    const monthStart = `${month}-01`;
    const [year, monthNumber] = month.split("-").map(Number);
    const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const records = await getRecords(profile);
    const intelligence = calculateCycleIntelligence({
      records,
      cycleLengthPreference: profile.cycleLengthPreferenceDays,
      periodLength: profile.periodLengthEstimateDays,
      asOfDate: dateInTimezone(profile.timezone || config.timezone),
    });
    const latest = records.at(-1);
    const predictedStarts = [];
    if (latest) {
      const today = dateInTimezone(profile.timezone || config.timezone);
      const elapsed = Math.max(
        0,
        differenceInDays(latest.actualPeriodStartDate, today),
      );
      const nextOffset = Math.floor(elapsed / intelligence.cycleLength) + 1;
      const monthEnd = addDays(monthStart, dayCount - 1);
      const cyclesToMonthEnd = Math.max(
        0,
        Math.floor(
          differenceInDays(today, monthEnd) / intelligence.cycleLength,
        ),
      );
      const forecastCount =
        monthEnd >= today ? Math.min(120, cyclesToMonthEnd + 2) : 0;
      for (let i = 0; i < forecastCount; i += 1)
        predictedStarts.push(
          addDays(
            latest.actualPeriodStartDate,
            (nextOffset + i) * intelligence.cycleLength,
          ),
        );
    }
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = addDays(monthStart, index);
      if (!latest)
        return {
          date,
          phase: null,
          actualPeriodStart: false,
          actualPeriod: false,
          predictedPeriod: false,
          fertileWindow: false,
          predictedOvulation: false,
        };
      return getCalendarDay({
        date,
        latestActualStart: latest.actualPeriodStartDate,
        cycleLength: intelligence.cycleLength,
        periodLength: profile.periodLengthEstimateDays,
        records,
        predictedStarts,
      });
    });
    return res.json({ success: true, month, days });
  } catch (err) {
    next(err);
  }
}

export async function getDailyCycleLogs(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const filter = { userId: req.user.id, profileId: profile._id };
    if (req.query.from && !isDateOnly(req.query.from))
      return res
        .status(400)
        .json({ success: false, error: "from must use YYYY-MM-DD format." });
    if (req.query.to && !isDateOnly(req.query.to))
      return res
        .status(400)
        .json({ success: false, error: "to must use YYYY-MM-DD format." });
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = req.query.from;
      if (req.query.to) filter.date.$lte = req.query.to;
    }
    const logs = await DailyCycleLog.find(filter).sort({ date: -1 });
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
}

export async function upsertDailyCycleLog(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const date =
      req.body.date || dateInTimezone(profile.timezone || config.timezone);
    if (!isDateOnly(date))
      return res
        .status(400)
        .json({ success: false, error: "date must use YYYY-MM-DD format." });
    if (date > dateInTimezone(profile.timezone || config.timezone))
      return res
        .status(400)
        .json({
          success: false,
          error: "Daily observations cannot be dated in the future.",
        });
    const {
      mood = null,
      energyLevel = null,
      painLevel = null,
      symptoms = [],
      notes = "",
    } = req.body;
    if (mood !== null && !MOODS.has(mood))
      return res
        .status(400)
        .json({ success: false, error: "Choose a supported mood value." });
    if (
      energyLevel !== null &&
      (!Number.isInteger(Number(energyLevel)) ||
        Number(energyLevel) < 1 ||
        Number(energyLevel) > 5)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Energy must be a whole number from 1 to 5.",
        });
    if (
      painLevel !== null &&
      (!Number.isInteger(Number(painLevel)) ||
        Number(painLevel) < 0 ||
        Number(painLevel) > 10)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Pain must be a whole number from 0 to 10.",
        });
    if (
      !Array.isArray(symptoms) ||
      symptoms.length > 12 ||
      symptoms.some((item) => typeof item !== "string" || item.length > 60)
    )
      return res
        .status(400)
        .json({ success: false, error: "Choose up to 12 symptom labels." });
    if (typeof notes !== "string" || notes.length > 1000)
      return res
        .status(400)
        .json({
          success: false,
          error: "Notes must be 1,000 characters or fewer.",
        });
    const log = await DailyCycleLog.findOneAndUpdate(
      { userId: req.user.id, profileId: profile._id, date },
      {
        $set: {
          mood,
          energyLevel: energyLevel === null ? null : Number(energyLevel),
          painLevel: painLevel === null ? null : Number(painLevel),
          symptoms,
          notes,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    return res.json({ success: true, log });
  } catch (err) {
    const issue = validationError(err);
    if (issue)
      return res
        .status(issue.status)
        .json({ success: false, error: issue.message });
    next(err);
  }
}

export async function deleteDailyCycleLog(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const log = await DailyCycleLog.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
      profileId: profile._id,
    });
    if (!log)
      return res
        .status(404)
        .json({ success: false, error: "Daily log not found." });
    return res.json({ success: true, message: "Daily log removed." });
  } catch (err) {
    next(err);
  }
}

export async function getCyclePredictions(req, res, next) {
  try {
    const profile = await ensureProfile(req.user.id);
    const today = dateInTimezone(profile.timezone || config.timezone);
    const records = await getRecords(profile);
    await calculateAndPersist(profile, records, today);
    const prediction = await CyclePrediction.findOne({
      userId: req.user.id,
      profileId: profile._id,
    }).populate("basedOnPeriodRecordId", "actualPeriodStartDate");
    return res.json({ success: true, prediction });
  } catch (err) {
    next(err);
  }
}
