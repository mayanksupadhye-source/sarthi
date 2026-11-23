import { ScheduleTemplate } from "../models/ScheduleTemplate.js";
import { ScheduleException } from "../models/ScheduleException.js";
import { Setting } from "../models/Setting.js";
import { removeJournalHistorySchedule } from "../services/journalScheduleMigration.js";
import mongoose from "mongoose";

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

    return res.json({ success: true, count: templates.length, templates });
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
      } else {
        return res
          .status(404)
          .json({
            success: false,
            error: `Template for day type "${dayType}" not found.`,
          });
      }
    }
    return res.json({ success: true, isException: false, template });
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
      isProtected = false,
      notes = "",
      courseSlug = null,
      blockType,
      isTrackable = false,
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

    let finalBlockType = blockType;
    if (!finalBlockType) {
      if (
        courseSlug ||
        ["study", "dsa", "webdev", "oratory"].includes(category)
      ) {
        finalBlockType = "learning";
      } else if (category === "exploration") {
        finalBlockType = "exploration";
      } else if (["routine", "rest", "college"].includes(category)) {
        finalBlockType = Boolean(isTrackable)
          ? "actionable_routine"
          : "fixed_routine";
      } else if (category === "gym") {
        finalBlockType = "actionable_routine";
      } else {
        finalBlockType = "learning";
      }
    }

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
      isTrackable: Boolean(isTrackable),
      isProtected: Boolean(isProtected),
      notes: (notes || "").trim(),
    };

    template.blocks.push(newBlock);
    template.updatedAt = new Date();
    await template.save();

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
      isProtected,
      notes,
      courseSlug,
      blockType,
      isTrackable,
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
    if (isProtected !== undefined) block.isProtected = Boolean(isProtected);
    if (notes !== undefined) block.notes = notes.trim();
    if (courseSlug !== undefined) block.courseSlug = courseSlug || null;
    if (blockType !== undefined) block.blockType = blockType;
    if (isTrackable !== undefined) block.isTrackable = Boolean(isTrackable);

    const sMin = timeToMinutes(block.startTime);
    const eMin = timeToMinutes(block.endTime);
    let dur = eMin - sMin;
    if (dur <= 0) dur += 24 * 60;
    block.durationMinutes = dur;

    template.updatedAt = new Date();
    await template.save();

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
    const settings = await Setting.findOne({ userId: req.user.id });

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
    if (dayType === "sunday") {
      const oratoryBlock = blocks.find(
        (b) =>
          b.category === "oratory" || b.label.toLowerCase().includes("oratory"),
      );
      const excelBlock = blocks.find(
        (b) =>
          b.label.toLowerCase().includes("excel") ||
          b.label.toLowerCase().includes("exploration"),
      );

      if (oratoryBlock && excelBlock) {
        warnings.push({
          type: "oratory_schedule_preference",
          message:
            "The 13-Week Oratory Program specifies a 2-hour practice slot (default 12:30–14:30 or 14:30–17:00). Current timetable slots Excel at 12:30–14:30 and Oratory at 14:30–17:00. This is balanced; choose your active preference in Timetable settings.",
        });
      }
    }

    // 3. Sleep window check (Monday-Friday 23:40 to 05:00 is 5h 20m)
    if (dayType === "weekday") {
      const sleepStart = timeToMinutes(settings?.sleepWindowStart || "23:40");
      const sleepEnd = timeToMinutes(settings?.sleepWindowEnd || "05:00");
      // Across midnight
      const sleepDuration = 24 * 60 - sleepStart + sleepEnd;
      if (sleepDuration < 360) {
        warnings.push({
          type: "short_sleep_window",
          durationMinutes: sleepDuration,
          hours: (sleepDuration / 60).toFixed(1),
          message: `The weekday schedule allocates ${sleepDuration} min (${(sleepDuration / 60).toFixed(1)} hrs) for sleep between ${settings?.sleepWindowStart || "23:40"} and ${settings?.sleepWindowEnd || "05:00"}. Consider setting protected sleep to at least 6.5–7 hours.`,
        });
      }
    }

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
