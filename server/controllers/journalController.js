import mongoose from "mongoose";
import { JournalEntry } from "../models/JournalEntry.js";
import { Note } from "../models/Note.js";
import {
  isValidJournalDate,
  journalPageParams,
  validateJournalContent,
} from "../services/journalRules.js";

function dateKeyForLegacy(note) {
  if (isValidJournalDate(note.date)) return note.date;
  const createdAt = new Date(note.createdAt);
  if (Number.isNaN(createdAt.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(createdAt);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function mapLegacyNote(note) {
  return {
    _id: String(note._id),
    source: "legacy-note",
    dateKey: dateKeyForLegacy(note),
    content: note.content || "",
    title: note.title || "Daily Journal",
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export async function getJournalEntries(req, res, next) {
  try {
    const { page, limit, offset } = journalPageParams(req.query);
    const dateKey = req.query.date || "";
    if (dateKey && !isValidJournalDate(dateKey)) {
      return res
        .status(400)
        .json({ success: false, error: "Choose a valid journal date." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const journalMatch = { userId, ...(dateKey ? { dateKey } : {}) };
    const legacyMatch = { userId, type: "journal" };
    if (dateKey) {
      const dayStart = new Date(`${dateKey}T00:00:00.000+05:30`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const createdOnDate = { createdAt: { $gte: dayStart, $lt: dayEnd } };
      legacyMatch.$or = [
        { date: dateKey },
        { $and: [{ date: { $exists: false } }, createdOnDate] },
        { $and: [{ date: null }, createdOnDate] },
        { $and: [{ date: "" }, createdOnDate] },
      ];
    }
    const pipeline = [
      { $match: journalMatch },
      {
        $project: {
          _id: 1,
          dateKey: 1,
          content: 1,
          createdAt: 1,
          updatedAt: 1,
          title: { $literal: "Daily Journal" },
          source: { $literal: "journal" },
        },
      },
      {
        $unionWith: {
          coll: Note.collection.name,
          pipeline: [
            { $match: legacyMatch },
            {
              $addFields: {
                dateKey: {
                  $cond: [
                    {
                      $regexMatch: {
                        input: {
                          $convert: {
                            input: "$date",
                            to: "string",
                            onError: "",
                            onNull: "",
                          },
                        },
                        regex: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
                      },
                    },
                    "$date",
                    {
                      $dateToString: {
                        date: "$createdAt",
                        format: "%Y-%m-%d",
                        timezone: "Asia/Kolkata",
                      },
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                dateKey: 1,
                content: 1,
                title: 1,
                createdAt: 1,
                updatedAt: 1,
                source: { $literal: "legacy-note" },
              },
            },
          ],
        },
      },
      ...(dateKey ? [{ $match: { dateKey } }] : []),
      { $sort: { dateKey: -1, createdAt: -1, _id: -1 } },
      {
        $facet: {
          entries: [{ $skip: offset }, { $limit: limit }],
          count: [{ $count: "total" }],
        },
      },
    ];
    const [result = { entries: [], count: [] }] =
      await JournalEntry.aggregate(pipeline);
    const entries = result.entries || [];
    const total = result.count?.[0]?.total || 0;
    return res.json({
      success: true,
      entries,
      pagination: {
        page,
        limit,
        total,
        hasPrevious: page > 1,
        hasNext: offset + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

function validateJournalBody(body) {
  const content = typeof body.content === "string" ? body.content : "";
  const dateKey = body.date;
  if (!isValidJournalDate(dateKey))
    return { error: "Choose a valid journal date." };
  const contentError = validateJournalContent(content);
  if (contentError) return { error: contentError };
  return { content, dateKey };
}

export async function createJournalEntry(req, res, next) {
  try {
    const validated = validateJournalBody(req.body);
    if (validated.error)
      return res.status(400).json({ success: false, error: validated.error });
    const submissionKey =
      typeof req.body.submissionKey === "string"
        ? req.body.submissionKey.trim()
        : "";
    if (!submissionKey || submissionKey.length > 128) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "A valid submission key is required to prevent duplicate saves.",
        });
    }

    const filter = { userId: req.user.id, submissionKey };
    const existing = await JournalEntry.findOne(filter);
    if (existing)
      return res.json({
        success: true,
        entry: existing,
        duplicateSubmission: true,
      });

    const entry = await JournalEntry.create({
      userId: req.user.id,
      journalDate: new Date(`${validated.dateKey}T00:00:00.000Z`),
      dateKey: validated.dateKey,
      content: validated.content,
      submissionKey,
    });
    return res
      .status(201)
      .json({ success: true, entry, duplicateSubmission: false });
  } catch (error) {
    if (error?.code === 11000) {
      try {
        const entry = await JournalEntry.findOne({
          userId: req.user.id,
          submissionKey: req.body.submissionKey,
        });
        if (entry)
          return res.json({ success: true, entry, duplicateSubmission: true });
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    next(error);
  }
}

export async function updateJournalEntry(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid journal entry ID." });
    }
    const validated = validateJournalBody(req.body);
    if (validated.error)
      return res.status(400).json({ success: false, error: validated.error });

    const entry = await JournalEntry.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      {
        $set: {
          journalDate: new Date(`${validated.dateKey}T00:00:00.000Z`),
          dateKey: validated.dateKey,
          content: validated.content,
          updatedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    );
    if (entry) return res.json({ success: true, entry, source: "journal" });

    const legacyNote = await Note.findOneAndUpdate(
      { _id: id, userId: req.user.id, type: "journal" },
      {
        $set: {
          date: validated.dateKey,
          content: validated.content,
          updatedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    );
    if (!legacyNote)
      return res
        .status(404)
        .json({ success: false, error: "Journal entry not found." });
    return res.json({
      success: true,
      entry: mapLegacyNote(legacyNote),
      source: "legacy-note",
    });
  } catch (error) {
    next(error);
  }
}
