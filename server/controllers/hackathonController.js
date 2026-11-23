import mongoose from "mongoose";
import { Hackathon } from "../models/Hackathon.js";
import { HackathonNotification } from "../models/HackathonNotification.js";
import {
  getHackathonLifecycle,
  getHackathonToday,
  migrateLegacyStages,
  normalizeHackathonStages,
  sortHackathons,
  validateHackathonDates,
} from "../services/hackathonLifecycle.js";
import { syncHackathonNotifications } from "../services/hackathonNotifications.js";

function validationError(res, message) {
  return res.status(400).json({ success: false, error: message });
}

function validateHackathonPayload(payload) {
  if (!payload.title || !payload.title.trim())
    return { error: "Hackathon title is required." };
  const dateError = validateHackathonDates(payload.startDate, payload.endDate);
  if (dateError) return { error: dateError };
  const budget = Number(payload.weeklyEffortBudgetHours);
  if (!Number.isFinite(budget) || budget < 0.5 || budget > 40) {
    return { error: "Weekly effort budget must be between 0.5 and 40 hours." };
  }
  if (payload.priority && !["P1", "P2", "P3"].includes(payload.priority)) {
    return { error: "Priority must be P1, P2, or P3." };
  }
  const stageResult = normalizeHackathonStages(
    payload.stages,
    payload.startDate,
    payload.endDate,
  );
  if (stageResult.error) return stageResult;
  return { stages: stageResult.stages, budget };
}

function validUrlOrEmpty(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function refreshLifecycle(hackathon, now = new Date()) {
  const today = getHackathonToday(now);
  let changed = false;
  if (
    !Array.isArray(hackathon.stages) ||
    hackathon.stages.length !== 6 ||
    !hackathon.stages.every((stage) => stage.key)
  ) {
    hackathon.stages = migrateLegacyStages(
      hackathon.stages,
      hackathon.startDate,
      hackathon.endDate,
      hackathon.registrationDeadline,
    );
    changed = true;
  }
  const lifecycle = getHackathonLifecycle(hackathon, today);
  if (
    hackathon.lifecycleStatus !== lifecycle.status ||
    hackathon.currentStage !== lifecycle.currentStage
  )
    changed = true;
  hackathon.lifecycleStatus = lifecycle.status;
  hackathon.currentStage = lifecycle.currentStage;
  if (changed) await hackathon.save();
  await syncHackathonNotifications(hackathon, now);
  return { lifecycle, nextStage: lifecycle.nextStage };
}

export async function getHackathons(req, res, next) {
  try {
    const records = await Hackathon.find({ userId: req.user.id });
    const now = new Date();
    const withLifecycle = await Promise.all(
      records.map(async (hackathon) => ({
        hackathon,
        ...(await refreshLifecycle(hackathon, now)),
      })),
    );
    const hackathons = sortHackathons(
      withLifecycle.map(({ hackathon, lifecycle, nextStage }) => ({
        ...hackathon.toObject(),
        lifecycleStatus: lifecycle.status,
        currentStage: lifecycle.currentStage,
        nextStage,
      })),
    );
    const alerts = await HackathonNotification.find({
      userId: req.user.id,
      scheduledFor: {
        $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    })
      .sort({ scheduledFor: 1 })
      .limit(100)
      .lean();
    return res.json({
      success: true,
      count: hackathons.length,
      hackathons,
      alerts,
    });
  } catch (err) {
    next(err);
  }
}

export async function createHackathon(req, res, next) {
  try {
    const payload = {
      ...req.body,
      title: typeof req.body.title === "string" ? req.body.title.trim() : "",
      weeklyEffortBudgetHours:
        req.body.weeklyEffortBudgetHours === undefined
          ? 6
          : Number(req.body.weeklyEffortBudgetHours),
      priority: req.body.priority || "P2",
    };
    const validation = validateHackathonPayload(payload);
    if (validation.error) return validationError(res, validation.error);
    if (!validUrlOrEmpty(payload.repoUrl))
      return validationError(
        res,
        "Repository URL must be a valid HTTP or HTTPS URL.",
      );

    const hackathon = await Hackathon.create({
      userId: req.user.id,
      title: payload.title,
      tagline: payload.tagline || "",
      theme: payload.theme || "",
      startDate: payload.startDate,
      endDate: payload.endDate,
      registrationDeadline: payload.stages.find(
        (stage) => stage.key === "registered",
      )?.endDate,
      currentStage: "registered",
      lifecycleStatus: getHackathonLifecycle({
        ...payload,
        submissionStatus: "not-submitted",
        submittedAt: null,
      }).status,
      submissionStatus: "not-submitted",
      priority: payload.priority,
      stages: validation.stages,
      weeklyEffortBudgetHours: validation.budget,
      repoUrl: payload.repoUrl || "",
    });
    const lifecycle = getHackathonLifecycle(hackathon);
    hackathon.lifecycleStatus = lifecycle.status;
    hackathon.currentStage = lifecycle.currentStage;
    await hackathon.save();
    await syncHackathonNotifications(hackathon);
    return res
      .status(201)
      .json({ success: true, hackathon, nextStage: lifecycle.nextStage });
  } catch (err) {
    next(err);
  }
}

export async function updateHackathon(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res
        .status(404)
        .json({ success: false, error: "Hackathon not found." });
    const hackathon = await Hackathon.findOne({ _id: id, userId: req.user.id });
    if (!hackathon)
      return res
        .status(404)
        .json({ success: false, error: "Hackathon not found." });
    const allowed = [
      "title",
      "tagline",
      "theme",
      "startDate",
      "endDate",
      "stages",
      "weeklyEffortBudgetHours",
      "repoUrl",
      "liveDemoUrl",
      "pitchDeckUrl",
      "notes",
      "priority",
      "teamMembers",
    ];
    const payload = { ...hackathon.toObject() };
    for (const key of allowed)
      if (Object.hasOwn(req.body, key)) payload[key] = req.body[key];
    payload.title =
      typeof payload.title === "string" ? payload.title.trim() : "";
    payload.weeklyEffortBudgetHours = Number(payload.weeklyEffortBudgetHours);
    const validation = validateHackathonPayload(payload);
    if (validation.error) return validationError(res, validation.error);
    if (!validUrlOrEmpty(payload.repoUrl))
      return validationError(
        res,
        "Repository URL must be a valid HTTP or HTTPS URL.",
      );

    for (const key of allowed) {
      if (key === "stages") hackathon.stages = validation.stages;
      else if (key === "weeklyEffortBudgetHours")
        hackathon[key] = validation.budget;
      else if (Object.hasOwn(req.body, key)) hackathon[key] = payload[key];
    }
    hackathon.registrationDeadline = validation.stages.find(
      (stage) => stage.key === "registered",
    )?.endDate;
    const lifecycle = getHackathonLifecycle(hackathon);
    hackathon.lifecycleStatus = lifecycle.status;
    hackathon.currentStage = lifecycle.currentStage;
    await hackathon.save();
    await syncHackathonNotifications(hackathon);
    return res.json({
      success: true,
      hackathon,
      nextStage: lifecycle.nextStage,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateHackathonStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["submitted", "completed", "not-submitted"].includes(status)) {
      return validationError(
        res,
        "Status must be submitted, completed, or not-submitted.",
      );
    }
    const hackathon = await Hackathon.findOne({ _id: id, userId: req.user.id });
    if (!hackathon)
      return res
        .status(404)
        .json({ success: false, error: "Hackathon not found." });
    hackathon.submissionStatus = status;
    hackathon.submittedAt = status === "submitted" ? new Date() : null;
    hackathon.completedAt = status === "completed" ? new Date() : null;
    const lifecycle = getHackathonLifecycle(hackathon);
    hackathon.lifecycleStatus = lifecycle.status;
    hackathon.currentStage = lifecycle.currentStage;
    await hackathon.save();
    await syncHackathonNotifications(hackathon);
    return res.json({ success: true, hackathon });
  } catch (err) {
    next(err);
  }
}

export async function markHackathonNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await HackathonNotification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification)
      return res
        .status(404)
        .json({ success: false, error: "Notification not found." });
    return res.json({ success: true, notification });
  } catch (err) {
    next(err);
  }
}

export async function deleteHackathon(req, res, next) {
  try {
    const { id } = req.params;
    const hackathon = await Hackathon.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });
    if (!hackathon)
      return res
        .status(404)
        .json({ success: false, error: "Hackathon not found." });
    await HackathonNotification.deleteMany({
      hackathonId: hackathon._id,
      userId: req.user.id,
    });
    return res.json({ success: true, message: "Hackathon removed." });
  } catch (err) {
    next(err);
  }
}
