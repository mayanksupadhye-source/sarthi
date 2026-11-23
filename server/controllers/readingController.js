import mongoose from "mongoose";
import { ReadingPhase } from "../models/ReadingPhase.js";
import { ReadingTrack } from "../models/ReadingTrack.js";
import { ReadingBook } from "../models/ReadingBook.js";
import { ReadingLog } from "../models/ReadingLog.js";
import { Habit } from "../models/Habit.js";
import { HabitLog } from "../models/HabitLog.js";
import {
  ensureReadingLibrary,
  syncReadingProgress,
  unlockNextBooks,
  uniquePages,
} from "../services/readingLibrary.js";
import { getTodayString } from "../utils/timeFormat.js";

const idIsValid = (value) => mongoose.Types.ObjectId.isValid(value);
const clean = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const dateIsValid = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const rangesOverlap = (startA, endA, startB, endB) =>
  endA > startA && endB > startB && startA < endB && startB < endA;

async function syncTodayReadingResponsibility(userId, date) {
  if (date !== getTodayString()) return;
  const habit = await Habit.findOne({
    userId,
    category: "night-routine",
    title: {
      $in: [
        "Book reading — 35 minutes",
        "Business reading (SPIN Selling / Influence)",
      ],
    },
    isActive: true,
  });
  if (!habit) return;
  const sessions = await ReadingLog.find({ userId, date })
    .select("durationMinutes")
    .lean();
  const totalMinutes = sessions.reduce(
    (sum, session) => sum + (Number(session.durationMinutes) || 0),
    0,
  );
  if (totalMinutes < (Number(habit.durationMinutes) || 35)) return;
  await HabitLog.findOneAndUpdate(
    { userId, habitId: habit._id, date },
    { $set: { completed: true } },
    { upsert: true, new: true },
  );
}

async function snapshot(userId) {
  const library = await ensureReadingLibrary(userId);
  const logs = await ReadingLog.find({ userId })
    .sort({ date: -1, createdAt: -1 })
    .lean();
  const minutes = logs.reduce(
    (sum, log) => sum + (Number(log.durationMinutes) || 0),
    0,
  );
  const pages = library.books.reduce(
    (sum, book) => sum + (Number(book.pagesRead) || 0),
    0,
  );
  const booksTracked = library.books.filter(
    (book) => book.status !== "archived",
  ).length;
  return {
    ...library,
    logs,
    stats: {
      totalSessions: logs.length,
      pagesRead: pages,
      totalMinutes: minutes,
      booksTracked,
    },
  };
}

export async function getReadingLibrary(req, res, next) {
  try {
    return res.json({ success: true, ...(await snapshot(req.user.id)) });
  } catch (error) {
    next(error);
  }
}

export async function createReadingSession(req, res, next) {
  try {
    const userId = req.user.id;
    await ensureReadingLibrary(userId);
    const {
      bookId,
      bookTitle,
      author = "",
      date,
      startPage = 0,
      endPage = 0,
      durationMinutes = 35,
      keyTakeaways = "",
      practicalApplication = "",
    } = req.body || {};
    if (!dateIsValid(date))
      return res
        .status(400)
        .json({ success: false, error: "Choose a valid session date." });
    const start = Number(startPage);
    const end = Number(endPage);
    const duration = Number(durationMinutes);
    if (
      !Number.isInteger(start) ||
      start < 0 ||
      start > 1000000 ||
      !Number.isInteger(end) ||
      end < start ||
      end > 1000000 ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration > 1440
    )
      return res
        .status(400)
        .json({ success: false, error: "Check the page range and duration." });
    if (
      String(keyTakeaways).length > 5000 ||
      String(practicalApplication).length > 3000
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Session reflections exceed the allowed length.",
        });
    let book = null;
    if (bookId && !idIsValid(bookId))
      return res
        .status(400)
        .json({ success: false, error: "Invalid book ID." });
    if (bookId) book = await ReadingBook.findOne({ _id: bookId, userId });
    if (bookId && !book)
      return res
        .status(404)
        .json({
          success: false,
          error: "Book not found in your reading library.",
        });
    if (!book) {
      const title = clean(bookTitle, 180);
      if (!title)
        return res
          .status(400)
          .json({ success: false, error: "Choose a book or enter its title." });
      book = await ReadingBook.findOne({
        userId,
        title: new RegExp(
          `^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      });
      if (!book) {
        let phase = await ReadingPhase.findOne({ userId, sequence: 99 });
        if (!phase)
          phase = await ReadingPhase.create({
            userId,
            sequence: 99,
            title: "Earlier Reading",
            description: "Books added from the session logger.",
            category: "Personal library",
          });
        let track = await ReadingTrack.findOne({
          userId,
          name: "Personal library",
        });
        if (!track) {
          const latestTrack = await ReadingTrack.findOne({ userId })
            .sort({ sequence: -1 })
            .select("sequence")
            .lean();
          track = await ReadingTrack.create({
            userId,
            sequence: (Number(latestTrack?.sequence) || 2) + 1,
            name: "Personal library",
          });
        }
        const latest = await ReadingBook.findOne({ userId, trackId: track._id })
          .sort({ sequence: -1 })
          .select("sequence")
          .lean();
        const sequence = (Number(latest?.sequence) || 0) + 1;
        book = await ReadingBook.create({
          userId,
          phaseId: phase._id,
          trackId: track._id,
          sequence,
          title,
          author: clean(author, 160) || "Unknown author",
          description: "Added from a reading session.",
          category: "Personal library",
          status: "available",
          isLegacy: true,
        });
      }
    }
    if (!["available", "reading"].includes(book.status))
      return res
        .status(409)
        .json({
          success: false,
          error: "Start or restore this book before logging a session.",
        });
    if (end > start) {
      const priorSessions = await ReadingLog.find({ userId, bookId: book._id })
        .select("startPage endPage")
        .lean();
      if (
        priorSessions.some((session) =>
          rangesOverlap(
            start,
            end,
            Number(session.startPage),
            Number(session.endPage),
          ),
        )
      ) {
        return res
          .status(409)
          .json({
            success: false,
            error: "That page range overlaps a saved session for this book.",
          });
      }
    }
    const log = await ReadingLog.create({
      userId,
      bookId: book._id,
      bookTitle: book.title,
      author: book.author,
      date,
      startPage: start,
      endPage: end,
      pagesRead: Math.max(0, end - start),
      durationMinutes: duration,
      keyTakeaways: clean(keyTakeaways, 5000),
      practicalApplication: clean(practicalApplication, 3000),
    });
    if (book.status === "available") {
      book.status = "reading";
      book.startedAt = book.startedAt || new Date();
      await book.save();
    }
    await syncReadingProgress(userId, book._id);
    await syncTodayReadingResponsibility(userId, date);
    return res
      .status(201)
      .json({
        success: true,
        log,
        book: await ReadingBook.findById(book._id).lean(),
      });
  } catch (error) {
    next(error);
  }
}

export async function createReadingPhase(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      title,
      description = "",
      category = "",
      sequence,
      books = [],
    } = req.body || {};
    if (
      !clean(title, 120) ||
      !Array.isArray(books) ||
      books.length < 1 ||
      books.length > 2
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "A phase needs a title and one or two books.",
        });
    if (
      books.some(
        (book) => !clean(book?.title, 180) || !clean(book?.author, 160),
      )
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Each book requires a title and author.",
        });
    await ensureReadingLibrary(userId);
    const highestPhase = await ReadingPhase.findOne({
      userId,
      status: "active",
      sequence: { $ne: 99 },
    })
      .sort({ sequence: -1 })
      .select("sequence")
      .lean();
    const phaseSequence =
      Number(sequence) || (Number(highestPhase?.sequence) || 0) + 1;
    const phase = await ReadingPhase.create({
      userId,
      title: clean(title, 120),
      description: clean(description, 1200),
      category: clean(category, 80),
      sequence: phaseSequence,
    });
    const createdBooks = [];
    for (let index = 0; index < books.length; index += 1) {
      const input = books[index];
      const trackName = clean(input.track, 80) || `Track ${index ? "B" : "A"}`;
      const namedTrack = await ReadingTrack.findOne({
        userId,
        name: trackName,
      });
      const highestTrack = await ReadingTrack.findOne({ userId })
        .sort({ sequence: -1 })
        .select("sequence")
        .lean();
      const trackSequence =
        trackName.toLowerCase() === "track a"
          ? 1
          : trackName.toLowerCase() === "track b"
            ? 2
            : namedTrack?.sequence || (Number(highestTrack?.sequence) || 2) + 1;
      let track = await ReadingTrack.findOne({
        userId,
        sequence: trackSequence,
      });
      if (!track)
        track = await ReadingTrack.create({
          userId,
          name: trackName,
          sequence: trackSequence,
        });
      const prior = await ReadingBook.findOne({
        userId,
        trackId: track._id,
      }).sort({ sequence: -1 });
      createdBooks.push(
        await ReadingBook.create({
          userId,
          phaseId: phase._id,
          trackId: track._id,
          sequence: Number(input.sequence) || (prior?.sequence || 0) + 1,
          title: clean(input.title, 180),
          author: clean(input.author, 160),
          description: clean(input.description, 2400),
          category: clean(input.category, 80) || clean(category, 80),
          totalPages:
            Number(input.totalPages) > 0 ? Number(input.totalPages) : null,
          coverImage: clean(input.coverImage, 1000),
          status: "upcoming",
        }),
      );
    }
    await unlockNextBooks(userId);
    return res.status(201).json({ success: true, phase, books: createdBooks });
  } catch (error) {
    next(error);
  }
}

export async function createReadingBook(req, res, next) {
  try {
    const userId = req.user.id;
    const input = req.body || {};
    if (
      !idIsValid(input.phaseId) ||
      !clean(input.title, 180) ||
      !clean(input.author, 160)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Select a phase and provide a title and author.",
        });
    const phase = await ReadingPhase.findOne({ _id: input.phaseId, userId });
    if (!phase || phase.status !== "active")
      return res
        .status(404)
        .json({ success: false, error: "Active phase not found." });
    const tracks = await ReadingTrack.find({ userId }).sort({ sequence: 1 });
    let track =
      input.trackId && idIsValid(input.trackId)
        ? tracks.find((item) => String(item._id) === String(input.trackId))
        : input.track
          ? tracks.find((item) => item.name === clean(input.track, 80))
          : tracks.find((item) => item.name === "Track A");
    if (!track) {
      const sequence =
        tracks.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
      track = await ReadingTrack.create({
        userId,
        sequence,
        name:
          clean(input.track, 80) ||
          `Track ${String.fromCharCode(64 + sequence)}`,
      });
    }
    const trackBooks = await ReadingBook.find({
      userId,
      trackId: track._id,
    }).populate("phaseId");
    trackBooks.sort((a, b) => a.sequence - b.sequence);
    const phaseSequence = phase.sequence;
    let insertAt = trackBooks.findIndex(
      (book) => (book.phaseId?.sequence || 99) > phaseSequence,
    );
    if (insertAt < 0) insertAt = trackBooks.length;
    const samePhase = trackBooks.reduce(
      (last, book, index) =>
        String(book.phaseId?._id) === String(phase._id) ? index + 1 : last,
      insertAt,
    );
    insertAt = samePhase;
    await ReadingBook.updateMany(
      { userId, trackId: track._id },
      { $inc: { sequence: 1000000 } },
    );
    let book = null,
      oldIndex = 0;
    for (let index = 0; index <= trackBooks.length; index += 1) {
      if (index === insertAt) {
        book = await ReadingBook.create({
          userId,
          phaseId: phase._id,
          trackId: track._id,
          sequence: index + 1,
          title: clean(input.title, 180),
          author: clean(input.author, 160),
          description: clean(input.description, 2400),
          category: clean(input.category, 80),
          totalPages:
            Number(input.totalPages) > 0 ? Number(input.totalPages) : null,
          coverImage: clean(input.coverImage, 1000),
          status: "upcoming",
        });
      } else {
        await ReadingBook.updateOne(
          { _id: trackBooks[oldIndex]._id, userId },
          { $set: { sequence: index + 1 } },
        );
        oldIndex += 1;
      }
    }
    await unlockNextBooks(userId);
    return res.status(201).json({ success: true, book });
  } catch (error) {
    next(error);
  }
}

export async function updateReadingBook(req, res, next) {
  try {
    const { id } = req.params;
    if (!idIsValid(id))
      return res
        .status(400)
        .json({ success: false, error: "Invalid book ID." });
    const userId = req.user.id;
    const book = await ReadingBook.findOne({ _id: id, userId });
    if (!book)
      return res.status(404).json({ success: false, error: "Book not found." });
    const body = req.body || {};
    for (const field of [
      "title",
      "author",
      "description",
      "category",
      "coverImage",
    ])
      if (body[field] !== undefined)
        book[field] = clean(
          body[field],
          field === "description"
            ? 2400
            : field === "coverImage"
              ? 1000
              : field === "title"
                ? 180
                : 160,
        );
    if (body.totalPages !== undefined) {
      const pages = Number(body.totalPages);
      if (!Number.isInteger(pages) || pages < 1)
        return res
          .status(400)
          .json({
            success: false,
            error: "Total pages must be a positive whole number.",
          });
      book.totalPages = pages;
      book.readingProgress = Math.min(
        100,
        Math.round((book.currentPage / pages) * 100),
      );
    }
    if (body.action === "start") {
      if (!["available", "reading"].includes(book.status))
        return res
          .status(409)
          .json({
            success: false,
            error: "This book is not currently available to start.",
          });
      book.status = "reading";
      book.startedAt = book.startedAt || new Date();
    }
    if (body.action === "complete") {
      if (book.status !== "reading")
        return res
          .status(409)
          .json({
            success: false,
            error: "Start reading this book before completing it.",
          });
      book.status = "completed";
      book.completedAt = new Date();
    }
    if (body.action === "pause") {
      if (book.status !== "reading")
        return res
          .status(409)
          .json({
            success: false,
            error: "Only a currently reading book can be paused.",
          });
      book.status = "paused";
    }
    if (body.action === "resume") {
      if (book.status !== "paused")
        return res
          .status(409)
          .json({ success: false, error: "This book is not paused." });
      book.status = "reading";
    }
    if (body.action === "archive") {
      book.status = "archived";
      book.archivedAt = new Date();
    }
    if (body.action === "restore") {
      if (!["archived", "completed"].includes(book.status))
        return res
          .status(409)
          .json({
            success: false,
            error: "Only an archived or completed book can be reopened.",
          });
      book.status = book.currentPage > 0 ? "reading" : "available";
      book.completedAt = null;
      book.archivedAt = null;
      book.startedAt = book.startedAt || new Date();
    }
    await book.save();
    await unlockNextBooks(userId);
    return res.json({ success: true, book });
  } catch (error) {
    next(error);
  }
}

export async function reorderReadingBooks(req, res, next) {
  try {
    const { trackId, orderedBookIds } = req.body || {};
    const userId = req.user.id;
    if (
      !idIsValid(trackId) ||
      !Array.isArray(orderedBookIds) ||
      !orderedBookIds.every(idIsValid)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Provide a track and ordered book IDs.",
        });
    const books = await ReadingBook.find({
      userId,
      trackId,
      _id: { $in: orderedBookIds },
    });
    if (books.length !== orderedBookIds.length)
      return res
        .status(400)
        .json({
          success: false,
          error:
            "The order must contain every active book in this track exactly once.",
        });
    await ReadingBook.updateMany(
      { userId, trackId, _id: { $in: orderedBookIds } },
      { $inc: { sequence: 1000000 } },
    );
    for (let index = 0; index < orderedBookIds.length; index += 1)
      await ReadingBook.updateOne(
        { userId, trackId, _id: orderedBookIds[index] },
        { $set: { sequence: index + 1 } },
      );
    return res.json({
      success: true,
      books: await ReadingBook.find({ userId, trackId }).sort({ sequence: 1 }),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateReadingSession(req, res, next) {
  try {
    const { id } = req.params;
    if (!idIsValid(id))
      return res
        .status(400)
        .json({ success: false, error: "Invalid session ID." });
    const userId = req.user.id;
    const log = await ReadingLog.findOne({ _id: id, userId });
    if (!log)
      return res
        .status(404)
        .json({ success: false, error: "Reading session not found." });
    const body = req.body || {};
    const start = Number(body.startPage);
    const end = Number(body.endPage);
    const duration = Number(body.durationMinutes);
    if (
      body.keyTakeaways !== undefined &&
      String(body.keyTakeaways).length > 5000
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Key takeaways exceed 5000 characters.",
        });
    if (
      body.practicalApplication !== undefined &&
      String(body.practicalApplication).length > 3000
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Practical application exceeds 3000 characters.",
        });
    if (body.date !== undefined && !dateIsValid(body.date))
      return res
        .status(400)
        .json({ success: false, error: "Choose a valid session date." });
    if (
      body.startPage !== undefined &&
      (!Number.isInteger(start) || start < 0 || start > 1000000)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Start page must be between zero and one million.",
        });
    if (
      body.endPage !== undefined &&
      (!Number.isInteger(end) ||
        end > 1000000 ||
        end < (body.startPage === undefined ? log.startPage : start))
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "End page must be between the start page and one million.",
        });
    const nextStart =
      body.startPage === undefined ? Number(log.startPage) : start;
    const nextEnd = body.endPage === undefined ? Number(log.endPage) : end;
    if (log.bookId && nextEnd > nextStart) {
      const priorSessions = await ReadingLog.find({
        userId,
        bookId: log.bookId,
        _id: { $ne: log._id },
      })
        .select("startPage endPage")
        .lean();
      if (
        priorSessions.some((session) =>
          rangesOverlap(
            nextStart,
            nextEnd,
            Number(session.startPage),
            Number(session.endPage),
          ),
        )
      ) {
        return res
          .status(409)
          .json({
            success: false,
            error:
              "That page range overlaps another saved session for this book.",
          });
      }
    }
    for (const field of [
      "date",
      "startPage",
      "endPage",
      "durationMinutes",
      "keyTakeaways",
      "practicalApplication",
    ])
      if (body[field] !== undefined) log[field] = body[field];
    if (
      body.durationMinutes !== undefined &&
      (!Number.isFinite(duration) || duration < 0 || duration > 1440)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Duration must be between 0 and 1440 minutes.",
        });
    log.pagesRead = Math.max(0, Number(log.endPage) - Number(log.startPage));
    await log.save();
    if (log.bookId) await syncReadingProgress(userId, log.bookId);
    return res.json({ success: true, log });
  } catch (error) {
    next(error);
  }
}

export async function deleteReadingSession(req, res, next) {
  try {
    const { id } = req.params;
    if (!idIsValid(id))
      return res
        .status(400)
        .json({ success: false, error: "Invalid session ID." });
    const log = await ReadingLog.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });
    if (!log)
      return res
        .status(404)
        .json({ success: false, error: "Reading session not found." });
    if (log.bookId) await syncReadingProgress(req.user.id, log.bookId);
    return res.json({ success: true, deletedId: id });
  } catch (error) {
    next(error);
  }
}

export async function getBookSessions(req, res, next) {
  try {
    const { bookId } = req.params;
    if (!idIsValid(bookId))
      return res
        .status(400)
        .json({ success: false, error: "Invalid book ID." });
    const book = await ReadingBook.findOne({
      _id: bookId,
      userId: req.user.id,
    });
    if (!book)
      return res.status(404).json({ success: false, error: "Book not found." });
    const sessions = await ReadingLog.find({ userId: req.user.id, bookId })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    return res.json({ success: true, book, sessions });
  } catch (error) {
    next(error);
  }
}

export async function deleteReadingBook(req, res, next) {
  try {
    const { id } = req.params;
    if (!idIsValid(id))
      return res
        .status(400)
        .json({ success: false, error: "Invalid book ID." });
    const userId = req.user.id,
      book = await ReadingBook.findOne({ _id: id, userId });
    if (!book)
      return res.status(404).json({ success: false, error: "Book not found." });
    const hasSessions = await ReadingLog.exists({ userId, bookId: book._id });
    if (hasSessions)
      return res
        .status(409)
        .json({
          success: false,
          error:
            "This book has session history. Archive it to preserve that history.",
        });
    await ReadingBook.deleteOne({ _id: book._id, userId });
    await unlockNextBooks(userId);
    return res.json({ success: true, deletedId: id });
  } catch (error) {
    next(error);
  }
}

export async function updateReadingPhase(req, res, next) {
  try {
    const { id } = req.params;
    if (!idIsValid(id))
      return res
        .status(400)
        .json({ success: false, error: "Invalid phase ID." });
    const userId = req.user.id;
    const phase = await ReadingPhase.findOne({ _id: id, userId });
    if (!phase)
      return res
        .status(404)
        .json({ success: false, error: "Phase not found." });
    const body = req.body || {};
    if (body.title !== undefined) phase.title = clean(body.title, 120);
    if (body.description !== undefined)
      phase.description = clean(body.description, 1200);
    if (body.category !== undefined) phase.category = clean(body.category, 80);
    if (body.action === "archive") {
      phase.status = "archived";
      await ReadingBook.updateMany(
        {
          userId,
          phaseId: phase._id,
          status: { $nin: ["completed", "archived"] },
        },
        { $set: { status: "archived", archivedAt: new Date() } },
      );
    }
    if (body.action === "restore") {
      phase.status = "active";
      await ReadingBook.updateMany(
        { userId, phaseId: phase._id, status: "archived" },
        { $set: { status: "upcoming", archivedAt: null } },
      );
    }
    await phase.save();
    await unlockNextBooks(userId);
    return res.json({ success: true, phase });
  } catch (error) {
    next(error);
  }
}

export async function reorderReadingPhases(req, res, next) {
  try {
    const userId = req.user.id;
    const { orderedPhaseIds } = req.body || {};
    if (
      !Array.isArray(orderedPhaseIds) ||
      !orderedPhaseIds.length ||
      !orderedPhaseIds.every(idIsValid)
    )
      return res
        .status(400)
        .json({ success: false, error: "Provide the ordered phase IDs." });
    const phases = await ReadingPhase.find({
      userId,
      _id: { $in: orderedPhaseIds },
      status: "active",
      sequence: { $ne: 99 },
    });
    if (phases.length !== orderedPhaseIds.length)
      return res
        .status(400)
        .json({
          success: false,
          error: "Order must include each active phase exactly once.",
        });
    await ReadingPhase.updateMany(
      { userId, sequence: { $ne: 99 } },
      { $inc: { sequence: 1000000 } },
    );
    for (let index = 0; index < orderedPhaseIds.length; index += 1)
      await ReadingPhase.updateOne(
        { userId, _id: orderedPhaseIds[index] },
        { $set: { sequence: index + 1 } },
      );
    const sortedPhases = await ReadingPhase.find({
      userId,
      status: "active",
    }).sort({ sequence: 1 });
    const tracks = await ReadingTrack.find({ userId });
    for (const track of tracks) {
      const books = await ReadingBook.find({
        userId,
        trackId: track._id,
      }).populate("phaseId");
      books.sort(
        (a, b) =>
          (a.phaseId?.sequence || 99) - (b.phaseId?.sequence || 99) ||
          a.sequence - b.sequence,
      );
      await ReadingBook.updateMany(
        { userId, trackId: track._id },
        { $inc: { sequence: 1000000 } },
      );
      for (let index = 0; index < books.length; index += 1)
        await ReadingBook.updateOne(
          { _id: books[index]._id, userId },
          { $set: { sequence: index + 1 } },
        );
    }
    await unlockNextBooks(userId);
    return res.json({ success: true, phases: sortedPhases });
  } catch (error) {
    next(error);
  }
}
