import {
  ScheduleTemplate,
  normalizeBlockType,
  resolveBlockFlexible,
} from "../models/ScheduleTemplate.js";
import { ScheduleException } from "../models/ScheduleException.js";
import { TimetableActivation } from "../models/TimetableActivation.js";
import { Setting } from "../models/Setting.js";
import { AllocationService } from "../services/allocationService.js";
import { getTodayString } from "../utils/timeFormat.js";
import { removeJournalHistorySchedule } from "../services/journalScheduleMigration.js";
import mongoose from "mongoose";

function calcDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const [y1, m1, day1] = startDate.split("-").map(Number);
  const [y2, m2, day2] = endDate.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, day1);
  const t2 = Date.UTC(y2, m2 - 1, day2);
  return Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)) + 1);
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

export async function getTemplates(req, res, next) {
  try {
    await removeJournalHistorySchedule(req.user.id);
    let templates = await ScheduleTemplate.find({ userId: req.user.id });

    // Auto-seed missing holiday template if needed
    const hasHoliday = templates.some((t) => t.dayType === "holiday");
    if (!hasHoliday) {
      const holidayTmpl = await ScheduleTemplate.create({
        userId: req.user.id,
        dayType: "holiday",
        title: "Complete Holiday / Preparation Leave Schedule",
        isDefault: false,
        blocks: [
          {
            blockId: "hol-1",
            label: "Morning Wakeup & Routine",
            startTime: "06:00",
            endTime: "07:00",
            durationMinutes: 60,
            category: "routine",
            isProtected: true,
          },
          {
            blockId: "hol-2",
            label: "Deep Focus Session I (Core Learning / DSA)",
            startTime: "07:00",
            endTime: "10:00",
            durationMinutes: 180,
            category: "study",
            isProtected: false,
          },
          {
            blockId: "hol-3",
            label: "Breakfast & Rest",
            startTime: "10:00",
            endTime: "11:00",
            durationMinutes: 60,
            category: "routine",
            isProtected: true,
          },
          {
            blockId: "hol-4",
            label: "Deep Focus Session II (Web Dev / Projects)",
            startTime: "11:00",
            endTime: "14:00",
            durationMinutes: 180,
            category: "webdev",
            isProtected: false,
          },
          {
            blockId: "hol-5",
            label: "Lunch & Power Nap",
            startTime: "14:00",
            endTime: "15:30",
            durationMinutes: 90,
            category: "rest",
            isProtected: true,
          },
          {
            blockId: "hol-6",
            label: "Secondary Skills & Problem Solving III",
            startTime: "15:30",
            endTime: "17:30",
            durationMinutes: 120,
            category: "study",
            isProtected: false,
          },
          {
            blockId: "hol-7",
            label: "Gym, Outdoor Activity & Dinner",
            startTime: "17:30",
            endTime: "20:00",
            durationMinutes: 150,
            category: "gym",
            isProtected: false,
          },
          {
            blockId: "hol-8",
            label: "Review, Reading & Next Day Setup",
            startTime: "20:00",
            endTime: "22:30",
            durationMinutes: 150,
            category: "study",
            isProtected: false,
          },
          {
            blockId: "hol-9",
            label: "Night Routine",
            startTime: "22:30",
            endTime: "23:40",
            durationMinutes: 70,
            category: "routine",
            isProtected: true,
          },
          {
            blockId: "hol-10",
            label: "Protected Sleep Window",
            startTime: "23:40",
            endTime: "06:00",
            durationMinutes: 380,
            category: "rest",
            isProtected: true,
          },
        ],
      });
      templates.push(holidayTmpl);
    }

    const hasExam = templates.some((t) => t.dayType === "exam");
    if (!hasExam) {
      const examTmpl = await ScheduleTemplate.create({
        userId: req.user.id,
        dayType: "exam",
        title: "Exam Mode Schedule",
        effectiveFrom: "2026-01-01",
        version: 1,
        isDefault: false,
        blocks: [
          { blockId: "exm-1", label: "Wakeup & Morning Routine", startTime: "06:00", endTime: "07:00", durationMinutes: 60, category: "routine", blockType: "checklist" },
          { blockId: "exm-2", label: "Exam Prep Slot I", startTime: "07:00", endTime: "10:00", durationMinutes: 180, category: "college", blockType: "checklist" },
          { blockId: "exm-3", label: "Breakfast & Rest", startTime: "10:00", endTime: "10:45", durationMinutes: 45, category: "routine", blockType: "checklist" },
          { blockId: "exm-4", label: "Exam Prep Slot II / Paper", startTime: "10:45", endTime: "13:30", durationMinutes: 165, category: "college", blockType: "checklist" },
          { blockId: "exm-5", label: "Lunch & Recovery", startTime: "13:30", endTime: "14:30", durationMinutes: 60, category: "routine", blockType: "checklist" },
          { blockId: "exm-6", label: "Exam Prep Slot III", startTime: "14:30", endTime: "18:00", durationMinutes: 210, category: "college", blockType: "checklist" },
          { blockId: "exm-7", label: "Gym & Walk", startTime: "18:00", endTime: "19:15", durationMinutes: 75, category: "gym", blockType: "checklist" },
          { blockId: "exm-8", label: "Dinner & Light Revision", startTime: "19:30", endTime: "22:30", durationMinutes: 180, category: "routine", blockType: "checklist" },
          { blockId: "exm-9", label: "Night Routine", startTime: "22:30", endTime: "23:40", durationMinutes: 70, category: "routine", blockType: "night_routine" },
          { blockId: "exm-10", label: "Sleep Window", startTime: "23:40", endTime: "06:00", durationMinutes: 380, category: "rest", blockType: "rest" },
        ],
      });
      templates.push(examTmpl);
    }

    const normalizedTemplates = templates.map((t) => {
      const obj = t.toObject ? t.toObject() : t;
      obj.blocks = (obj.blocks || []).map((b) => ({
        ...b,
        blockType: normalizeBlockType(b),
        isFlexible: resolveBlockFlexible(b),
      }));
      return obj;
    });

    return res.json({ success: true, count: normalizedTemplates.length, templates: normalizedTemplates });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateByDayType(req, res, next) {
  try {
    const { dayType } = req.params;
    const { date } = req.query;
    await removeJournalHistorySchedule(req.user.id);
    const dateStr = date || new Date().toISOString().split("T")[0];

    // 1. Check for date-specific ScheduleException first
    const exception = await ScheduleException.findOne({
      userId: req.user.id,
      date: dateStr,
    });
    if (exception) {
      let baseTemplate = null;
      if (exception.templateOverride) {
        baseTemplate =
          (await ScheduleTemplate.findOne({
            userId: req.user.id,
            dayType: exception.templateOverride,
            effectiveFrom: { $lte: dateStr },
          }).sort({ effectiveFrom: -1 })) ||
          (await ScheduleTemplate.findOne({
            userId: req.user.id,
            dayType: exception.templateOverride,
          }));
      }
      return res.json({
        success: true,
        isException: true,
        exception,
        template: {
          title: `Exception: ${exception.notes || exception.exceptionType.replace("_", " ").toUpperCase()}`,
          dayType: exception.templateOverride || "holiday",
          blocks: exception.customBlocks?.length
            ? exception.customBlocks
            : baseTemplate?.blocks || [],
        },
      });
    }

    // 2. Resolve template respecting effectiveFrom date versioning
    let template = await ScheduleTemplate.findOne({
      userId: req.user.id,
      dayType,
      effectiveFrom: { $lte: dateStr },
    }).sort({ effectiveFrom: -1 });

    if (!template) {
      template = await ScheduleTemplate.findOne({
        userId: req.user.id,
        dayType,
      }).sort({ effectiveFrom: 1 });
    }

    if (!template) {
      if (dayType === "holiday") {
        template = await ScheduleTemplate.create({
          userId: req.user.id,
          dayType: "holiday",
          title: "Complete Holiday / Preparation Leave Schedule",
          effectiveFrom: "2026-01-01",
          version: 1,
          isDefault: false,
          blocks: [
            {
              blockId: "hol-1",
              label: "Morning Wakeup & Routine",
              startTime: "06:00",
              endTime: "07:00",
              durationMinutes: 60,
              category: "routine",
              isProtected: true,
            },
            {
              blockId: "hol-2",
              label: "Deep Focus Session I (Core Learning / DSA)",
              startTime: "07:00",
              endTime: "10:00",
              durationMinutes: 180,
              category: "study",
              isProtected: false,
            },
            {
              blockId: "hol-3",
              label: "Breakfast & Rest",
              startTime: "10:00",
              endTime: "11:00",
              durationMinutes: 60,
              category: "routine",
              isProtected: true,
            },
            {
              blockId: "hol-4",
              label: "Deep Focus Session II (Web Dev / Projects)",
              startTime: "11:00",
              endTime: "14:00",
              durationMinutes: 180,
              category: "webdev",
              isProtected: false,
            },
            {
              blockId: "hol-5",
              label: "Lunch & Power Nap",
              startTime: "14:00",
              endTime: "15:30",
              durationMinutes: 90,
              category: "rest",
              isProtected: true,
            },
            {
              blockId: "hol-6",
              label: "Secondary Skills & Problem Solving III",
              startTime: "15:30",
              endTime: "17:30",
              durationMinutes: 120,
              category: "study",
              isProtected: false,
            },
            {
              blockId: "hol-7",
              label: "Gym, Outdoor Activity & Dinner",
              startTime: "17:30",
              endTime: "20:00",
              durationMinutes: 150,
              category: "gym",
              isProtected: false,
            },
            {
              blockId: "hol-8",
              label: "Review, Reading & Next Day Setup",
              startTime: "20:00",
              endTime: "22:30",
              durationMinutes: 150,
              category: "study",
              isProtected: false,
            },
            {
              blockId: "hol-9",
              label: "Night Routine",
              startTime: "22:30",
              endTime: "23:40",
              durationMinutes: 70,
              category: "routine",
              isProtected: true,
            },
            {
              blockId: "hol-10",
              label: "Protected Sleep Window",
              startTime: "23:40",
              endTime: "06:00",
              durationMinutes: 380,
              category: "rest",
              isProtected: true,
            },
          ],
        });
      } else if (dayType === "exam") {
        template = await ScheduleTemplate.create({
          userId: req.user.id,
          dayType: "exam",
          title: "Exam Mode Schedule",
          effectiveFrom: "2026-01-01",
          version: 1,
          isDefault: false,
          blocks: [
            { blockId: "exm-1", label: "Wakeup & Morning Routine", startTime: "06:00", endTime: "07:00", durationMinutes: 60, category: "routine", blockType: "checklist" },
            { blockId: "exm-2", label: "Exam Prep Slot I", startTime: "07:00", endTime: "10:00", durationMinutes: 180, category: "college", blockType: "checklist" },
            { blockId: "exm-3", label: "Breakfast & Rest", startTime: "10:00", endTime: "10:45", durationMinutes: 45, category: "routine", blockType: "checklist" },
            { blockId: "exm-4", label: "Exam Prep Slot II / Paper", startTime: "10:45", endTime: "13:30", durationMinutes: 165, category: "college", blockType: "checklist" },
            { blockId: "exm-5", label: "Lunch & Recovery", startTime: "13:30", endTime: "14:30", durationMinutes: 60, category: "routine", blockType: "checklist" },
            { blockId: "exm-6", label: "Exam Prep Slot III", startTime: "14:30", endTime: "18:00", durationMinutes: 210, category: "college", blockType: "checklist" },
            { blockId: "exm-7", label: "Gym & Walk", startTime: "18:00", endTime: "19:15", durationMinutes: 75, category: "gym", blockType: "checklist" },
            { blockId: "exm-8", label: "Dinner & Light Revision", startTime: "19:30", endTime: "22:30", durationMinutes: 180, category: "routine", blockType: "checklist" },
            { blockId: "exm-9", label: "Night Routine", startTime: "22:30", endTime: "23:40", durationMinutes: 70, category: "routine", blockType: "night_routine" },
            { blockId: "exm-10", label: "Sleep Window", startTime: "23:40", endTime: "06:00", durationMinutes: 380, category: "rest", blockType: "rest" },
          ],
        });
      } else {
        return res
          .status(404)
          .json({
            success: false,
            error: `Template for day type "${dayType}" not found.`,
          });
      }
    }
    const normTemplate = template.toObject ? template.toObject() : template;
    normTemplate.blocks = (normTemplate.blocks || []).map((b) => ({
      ...b,
      blockType: normalizeBlockType(b),
      isFlexible: resolveBlockFlexible(b),
    }));
    return res.json({ success: true, isException: false, template: normTemplate });
  } catch (err) {
    next(err);
  }
}

export async function createTemplateVersion(req, res, next) {
  try {
    const { dayType, title, effectiveFrom, blocks } = req.body;
    if (
      !dayType ||
      !effectiveFrom ||
      !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: "dayType and valid effectiveFrom (YYYY-MM-DD) are required.",
        });
    }

    const latest = await ScheduleTemplate.findOne({
      userId: req.user.id,
      dayType,
    }).sort({ version: -1 });
    const nextVersion = (latest?.version || 1) + 1;

    let templateBlocks = blocks;
    if (!templateBlocks || !templateBlocks.length) {
      templateBlocks = latest ? latest.blocks : [];
    }

    const newVersion = await ScheduleTemplate.create({
      userId: req.user.id,
      dayType,
      title: title || `${latest?.title || dayType} (v${nextVersion})`,
      effectiveFrom,
      version: nextVersion,
      blocks: templateBlocks,
      isDefault: false,
    });

    return res.status(201).json({ success: true, template: newVersion });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const { title, blocks } = req.body;
    await removeJournalHistorySchedule(req.user.id);
    if (blocks !== undefined && !Array.isArray(blocks)) {
      return res
        .status(400)
        .json({ success: false, error: "Schedule blocks must be an array." });
    }

    const template = await ScheduleTemplate.findOne({
      _id: id,
      userId: req.user.id,
    });
    if (!template) {
      return res
        .status(404)
        .json({ success: false, error: "Template not found." });
    }

    if (title)
      template.title =
        title === "Saturday Development & History Schedule"
          ? "Saturday Development Schedule"
          : title;
    if (blocks)
      template.blocks = blocks.filter(
        (block) =>
          !(
            template.dayType === "saturday" &&
            block.blockId === "sat-6" &&
            block.startTime === "20:30" &&
            block.endTime === "22:30"
          ),
      );
    template.updatedAt = new Date();
    await template.save();

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (e) {
      console.warn("[updateTemplate] Replan notice:", e.message);
    }

    return res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
}

export async function addBlockToTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const {
      label,
      startTime,
      endTime,
      category = "study",
      notes = "",
      courseSlug = null,
      blockType,
      isFlexible,
    } = req.body;

    if (!label || !startTime || !endTime) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Block label, startTime and endTime are required.",
        });
    }

    const template = mongoose.isValidObjectId(id)
      ? await ScheduleTemplate.findOne({
          $or: [{ _id: id }, { dayType: id }],
          userId: req.user.id,
        })
      : await ScheduleTemplate.findOne({ dayType: id, userId: req.user.id });

    if (!template) {
      return res
        .status(404)
        .json({ success: false, error: "Template not found." });
    }

    const sMin = timeToMinutes(startTime);
    const eMin = timeToMinutes(endTime);
    let dur = eMin - sMin;
    if (dur <= 0) dur += 24 * 60;

    const finalBlockType = normalizeBlockType({
      label,
      category,
      courseSlug,
      blockType,
    });
    const finalIsFlexible = resolveBlockFlexible({
      label,
      category,
      courseSlug,
      blockType: finalBlockType,
      isFlexible,
    });

    const blockId = `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newBlock = {
      blockId,
      label: label.trim(),
      startTime,
      endTime,
      durationMinutes: dur,
      category,
      blockType: finalBlockType,
      courseSlug: courseSlug || null,
      isFlexible: finalIsFlexible,
      notes: (notes || "").trim(),
    };

    template.blocks.push(newBlock);
    template.updatedAt = new Date();
    await template.save();

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (e) {
      console.warn("[addBlockToTemplate] Replan notice:", e.message);
    }

    return res.status(201).json({ success: true, block: newBlock, template });
  } catch (err) {
    next(err);
  }
}

export async function updateBlockInTemplate(req, res, next) {
  try {
    const { id, blockId } = req.params;
    const {
      label,
      startTime,
      endTime,
      category,
      notes,
      courseSlug,
      blockType,
      isFlexible,
    } = req.body;

    const template = mongoose.isValidObjectId(id)
      ? await ScheduleTemplate.findOne({
          $or: [{ _id: id }, { dayType: id }],
          userId: req.user.id,
        })
      : await ScheduleTemplate.findOne({ dayType: id, userId: req.user.id });

    if (!template) {
      return res
        .status(404)
        .json({ success: false, error: "Template not found." });
    }

    const block = template.blocks.find((b) => b.blockId === blockId);
    if (!block) {
      return res
        .status(404)
        .json({ success: false, error: "Block not found in template." });
    }

    if (label !== undefined) block.label = label.trim();
    if (startTime !== undefined) block.startTime = startTime;
    if (endTime !== undefined) block.endTime = endTime;
    if (category !== undefined) block.category = category;
    if (notes !== undefined) block.notes = notes.trim();
    if (courseSlug !== undefined) block.courseSlug = courseSlug || null;
    if (blockType !== undefined) block.blockType = normalizeBlockType({ ...block.toObject(), blockType });
    if (isFlexible !== undefined) {
      block.isFlexible = Boolean(isFlexible);
    } else if (blockType !== undefined || courseSlug !== undefined) {
      block.isFlexible = resolveBlockFlexible(block.toObject());
    }

    const sMin = timeToMinutes(block.startTime);
    const eMin = timeToMinutes(block.endTime);
    let dur = eMin - sMin;
    if (dur <= 0) dur += 24 * 60;
    block.durationMinutes = dur;

    template.updatedAt = new Date();
    await template.save();

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (e) {
      console.warn("[updateBlockInTemplate] Replan notice:", e.message);
    }

    return res.json({ success: true, block, template });
  } catch (err) {
    next(err);
  }
}

export async function deleteBlockFromTemplate(req, res, next) {
  try {
    const { id, blockId } = req.params;

    const template = mongoose.isValidObjectId(id)
      ? await ScheduleTemplate.findOne({
          $or: [{ _id: id }, { dayType: id }],
          userId: req.user.id,
        })
      : await ScheduleTemplate.findOne({ dayType: id, userId: req.user.id });

    if (!template) {
      return res
        .status(404)
        .json({ success: false, error: "Template not found." });
    }

    template.blocks = template.blocks.filter((b) => b.blockId !== blockId);
    template.updatedAt = new Date();
    await template.save();

    try {
      await AllocationService.replanFrom(req.user.id, getTodayString());
    } catch (e) {
      console.warn("[deleteBlockFromTemplate] Replan notice:", e.message);
    }

    return res.json({
      success: true,
      message: "Block removed from template.",
      template,
    });
  } catch (err) {
    next(err);
  }
}

export async function getScheduleExceptions(req, res, next) {
  try {
    const exceptions = await ScheduleException.find({
      userId: req.user.id,
    }).sort({ date: 1 });
    return res.json({ success: true, count: exceptions.length, exceptions });
  } catch (err) {
    next(err);
  }
}

export async function createScheduleException(req, res, next) {
  try {
    const {
      date,
      exceptionType = "college_holiday",
      templateOverride = "holiday",
      notes = "",
      extraAvailableMinutes = 0,
    } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({
          success: false,
          error: "A valid date (YYYY-MM-DD) is required.",
        });
    }

    const exception = await ScheduleException.findOneAndUpdate(
      { userId: req.user.id, date },
      {
        userId: req.user.id,
        date,
        exceptionType,
        templateOverride,
        notes: (notes || "").trim(),
        extraAvailableMinutes: Number(extraAvailableMinutes) || 0,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true },
    );

    try {
      await AllocationService.replanFrom(req.user.id, date);
    } catch (e) {
      console.warn("[createScheduleException] Replan notice:", e.message);
    }

    return res.status(201).json({ success: true, exception });
  } catch (err) {
    next(err);
  }
}

export async function deleteScheduleException(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await ScheduleException.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Schedule exception not found." });
    }

    try {
      await AllocationService.replanFrom(req.user.id, deleted.date);
    } catch (e) {
      console.warn("[deleteScheduleException] Replan notice:", e.message);
    }

    return res.json({
      success: true,
      message: "Schedule exception removed successfully.",
    });
  } catch (err) {
    next(err);
  }
}

export async function detectConflicts(req, res, next) {
  try {
    const { dayType = "sunday" } = req.query;
    const template = await ScheduleTemplate.findOne({
      userId: req.user.id,
      dayType,
    });
    if (!template) {
      return res
        .status(404)
        .json({ success: false, error: "Template not found." });
    }

    const blocks = template.blocks || [];
    const conflicts = [];
    const warnings = [];

    // 1. Time overlap checks between blocks
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const b1 = blocks[i];
        const b2 = blocks[j];
        const s1 = timeToMinutes(b1.startTime);
        const e1 = timeToMinutes(b1.endTime);
        const s2 = timeToMinutes(b2.startTime);
        const e2 = timeToMinutes(b2.endTime);

        // Check overlap (handling non-cross-midnight standard blocks)
        if (s1 < e2 && s2 < e1) {
          conflicts.push({
            type: "time_overlap",
            block1: b1.label,
            block2: b2.label,
            time1: `${b1.startTime}-${b1.endTime}`,
            time2: `${b2.startTime}-${b2.endTime}`,
            message: `Overlap detected between "${b1.label}" and "${b2.label}".`,
          });
        }
      }
    }

    // 2. Specific Sunday Oratory vs Excel/Exploration conflict check (documented in DEFAULT_TIMETABLE.md)
    return res.json({
      success: true,
      dayType,
      conflictsCount: conflicts.length,
      conflicts,
      warningsCount: warnings.length,
      warnings,
    });
  } catch (err) {
    next(err);
  }
}

export async function getActivations(req, res, next) {
  try {
    const activations = await TimetableActivation.find({
      userId: req.user.id,
    }).sort({ startDate: 1 });

    const setting = await Setting.findOne({ userId: req.user.id });
    const totalExamBudget = Math.min(14, Math.max(1, Number(setting?.semesterExamDaysBudget) || 14));

    let usedExamDays = 0;
    let confirmedUntil = null;
    const enriched = activations.map((a) => {
      const dayCount = calcDaysBetween(a.startDate, a.endDate);
      if (a.profileId === "exam") {
        usedExamDays += dayCount;
      }
      if (!confirmedUntil || a.endDate > confirmedUntil) {
        confirmedUntil = a.endDate;
      }
      return {
        ...a.toObject(),
        dayCount,
      };
    });

    const remainingExamDays = Math.max(0, totalExamBudget - usedExamDays);

    return res.json({
      success: true,
      count: enriched.length,
      activations: enriched,
      confirmedUntil,
      examBudget: {
        total: totalExamBudget,
        used: usedExamDays,
        remaining: remainingExamDays,
        hardMax: 14,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createActivation(req, res, next) {
  try {
    const { profileId, startDate, endDate, notes = "", confirmExceed = false } = req.body;
    if (!profileId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "profileId, startDate, and endDate are required.",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate must not be after endDate.",
      });
    }

    const newDays = calcDaysBetween(startDate, endDate);

    // Check existing activations for overlap & budget
    const existing = await TimetableActivation.find({ userId: req.user.id });
    const overlaps = existing.filter(
      (a) => a.startDate <= endDate && startDate <= a.endDate,
    );
    let overlapWarning = null;
    if (overlaps.length > 0) {
      const names = overlaps.map((o) => `${o.profileId} (${o.startDate} to ${o.endDate})`).join(", ");
      overlapWarning = `Notice: This range overlaps with: ${names}. This new activation will take precedence.`;
    }

    // Exam budget check (Hard maximum is 14 days, configurable down, never above 14)
    if (profileId === "exam") {
      const setting = await Setting.findOne({ userId: req.user.id });
      const totalExamBudget = Math.min(14, Math.max(1, Number(setting?.semesterExamDaysBudget) || 14));
      const currentUsed = existing
        .filter((a) => a.profileId === "exam")
        .reduce((sum, a) => sum + calcDaysBetween(a.startDate, a.endDate), 0);

      if (currentUsed + newDays > totalExamBudget) {
        const remaining = Math.max(0, totalExamBudget - currentUsed);
        return res.status(400).json({
          success: false,
          exceededMax: true,
          warning: "exceeds_budget",
          error: `Blocked: Adding ${newDays} exam days would total ${currentUsed + newDays} days, exceeding the ${totalExamBudget}-day maximum (${currentUsed} used, ${remaining} remaining).`,
          message: `Blocked: Adding ${newDays} exam days would total ${currentUsed + newDays} days, exceeding the ${totalExamBudget}-day maximum (${currentUsed} used, ${remaining} remaining).`,
          budget: {
            total: totalExamBudget,
            used: currentUsed,
            requested: newDays,
            remaining,
          },
        });
      }
    }

    const activation = await TimetableActivation.create({
      userId: req.user.id,
      profileId,
      startDate,
      endDate,
      notes: notes.trim(),
    });

    try {
      await AllocationService.replanFrom(req.user.id, startDate);
    } catch (replanErr) {
      console.warn("[createActivation] Replan notice:", replanErr.message);
    }

    return res.status(201).json({
      success: true,
      activation: { ...activation.toObject(), dayCount: newDays },
      overlapWarning,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateActivation(req, res, next) {
  try {
    const { id } = req.params;
    const { profileId, startDate, endDate, notes = "", confirmExceed = false } = req.body;

    const existing = await TimetableActivation.findOne({ _id: id, userId: req.user.id });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Activation not found." });
    }

    const finalStart = startDate || existing.startDate;
    const finalEnd = endDate || existing.endDate;
    const finalProfile = profileId || existing.profileId;

    if (finalStart > finalEnd) {
      return res.status(400).json({ success: false, error: "startDate must not be after endDate." });
    }

    const newDays = calcDaysBetween(finalStart, finalEnd);

    // Overlap check against others
    const others = await TimetableActivation.find({ userId: req.user.id, _id: { $ne: id } });
    const overlaps = others.filter((a) => a.startDate <= finalEnd && finalStart <= a.endDate);
    let overlapWarning = null;
    if (overlaps.length > 0) {
      const names = overlaps.map((o) => `${o.profileId} (${o.startDate} to ${o.endDate})`).join(", ");
      overlapWarning = `Notice: This range overlaps with: ${names}. This updated activation will take precedence.`;
    }

    // Exam budget check (Hard maximum is 14 days, configurable down, never above 14)
    if (finalProfile === "exam") {
      const setting = await Setting.findOne({ userId: req.user.id });
      const totalExamBudget = Math.min(14, Math.max(1, Number(setting?.semesterExamDaysBudget) || 14));
      const otherUsed = others
        .filter((a) => a.profileId === "exam")
        .reduce((sum, a) => sum + calcDaysBetween(a.startDate, a.endDate), 0);

      if (otherUsed + newDays > totalExamBudget) {
        const remaining = Math.max(0, totalExamBudget - otherUsed);
        return res.status(400).json({
          success: false,
          exceededMax: true,
          warning: "exceeds_budget",
          error: `Blocked: Updating to ${newDays} exam days would total ${otherUsed + newDays} days, exceeding the ${totalExamBudget}-day maximum (${otherUsed} used, ${remaining} remaining).`,
          message: `Blocked: Updating to ${newDays} exam days would total ${otherUsed + newDays} days, exceeding the ${totalExamBudget}-day maximum (${otherUsed} used, ${remaining} remaining).`,
          budget: {
            total: totalExamBudget,
            used: otherUsed,
            requested: newDays,
            remaining,
          },
        });
      }
    }

    const oldStart = existing.startDate;
    existing.profileId = finalProfile;
    existing.startDate = finalStart;
    existing.endDate = finalEnd;
    existing.notes = notes !== undefined ? notes.trim() : existing.notes;
    existing.updatedAt = new Date();
    await existing.save();

    const earliestStart = oldStart < finalStart ? oldStart : finalStart;
    try {
      await AllocationService.replanFrom(req.user.id, earliestStart);
    } catch (replanErr) {
      console.warn("[updateActivation] Replan notice:", replanErr.message);
    }

    return res.json({
      success: true,
      activation: { ...existing.toObject(), dayCount: newDays },
      overlapWarning,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteActivation(req, res, next) {
  try {
    const { id } = req.params;
    const activation = await TimetableActivation.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });
    if (!activation) {
      return res
        .status(404)
        .json({ success: false, error: "Activation not found." });
    }

    try {
      await AllocationService.replanFrom(req.user.id, activation.startDate);
    } catch (replanErr) {
      console.warn("[deleteActivation] Replan notice:", replanErr.message);
    }

    return res.json({ success: true, message: "Activation removed." });
  } catch (err) {
    next(err);
  }
}
