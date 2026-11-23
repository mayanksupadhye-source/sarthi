import { AcademicSubject } from "../models/AcademicSubject.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Assignment } from "../models/Assignment.js";
import { Examination } from "../models/Examination.js";
import { ScheduleException } from "../models/ScheduleException.js";
import { Setting } from "../models/Setting.js";
import { AttendanceEngine } from "../services/attendanceEngine.js";

export async function getSubjects(req, res, next) {
  try {
    const subjects = await AcademicSubject.find({
      userId: req.user.id,
      archivedAt: null,
    });

    // Enrich with computed status
    const enriched = subjects.map((s) => {
      const theoryStatus = AttendanceEngine.calculateAttendanceStatus(
        s.attendedTheorySessions,
        s.totalTheorySessions,
        s.targetAttendancePercent || 85,
      );
      const practicalStatus =
        s.type !== "theory"
          ? AttendanceEngine.calculateAttendanceStatus(
              s.attendedPracticalSessions,
              s.totalPracticalSessions,
              s.targetAttendancePercent || 85,
            )
          : null;

      return {
        ...s.toObject(),
        theoryStatus,
        practicalStatus,
      };
    });

    return res.json({
      success: true,
      count: enriched.length,
      subjects: enriched,
    });
  } catch (err) {
    next(err);
  }
}

export async function createSubject(req, res, next) {
  try {
    const {
      code,
      name,
      type = "theory",
      faculty = "",
      room = "",
      minimumAttendancePercent = 75,
      targetAttendancePercent = 85,
    } = req.body;

    if (!code || !name) {
      return res
        .status(400)
        .json({ success: false, error: "Subject code and name are required." });
    }

    const subject = await AcademicSubject.create({
      userId: req.user.id,
      code: code.trim(),
      name: name.trim(),
      type,
      faculty: faculty.trim(),
      room: room.trim(),
      minimumAttendancePercent: Number(minimumAttendancePercent) || 75,
      targetAttendancePercent: Number(targetAttendancePercent) || 85,
    });

    return res.status(201).json({ success: true, subject });
  } catch (err) {
    next(err);
  }
}

export async function archiveSubject(req, res, next) {
  try {
    const subject = await AcademicSubject.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, archivedAt: null },
      { $set: { archivedAt: new Date() } },
      { new: true },
    );
    if (!subject)
      return res
        .status(404)
        .json({ success: false, error: "Active subject not found." });
    return res.json({ success: true, subject });
  } catch (err) {
    next(err);
  }
}

export async function markAttendance(req, res, next) {
  try {
    const { subjectId, date, type = "theory", status, notes = "" } = req.body;

    if (
      !subjectId ||
      !date ||
      !["present", "absent", "cancelled", "exempted"].includes(status) ||
      !["theory", "practical"].includes(type) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Provide a valid subject, date, session type and attendance status.",
        });
    }

    const subject = await AcademicSubject.findOne({
      _id: subjectId,
      userId: req.user.id,
    });
    if (!subject) {
      return res
        .status(404)
        .json({ success: false, error: "Subject not found." });
    }

    const previous = await AttendanceRecord.findOne({
      userId: req.user.id,
      subjectId,
      date,
      type,
    });
    const correctionHistory = previous
      ? [
          ...(previous.correctionHistory || []),
          {
            previousStatus: previous.status,
            previousNotes: previous.notes,
            previousDate: previous.date,
            correctedAt: new Date(),
          },
        ]
      : [];
    // Unique user/subject/date/type key makes repeated edits corrections, never duplicate sessions.
    const record = await AttendanceRecord.findOneAndUpdate(
      { userId: req.user.id, subjectId, date, type },
      { $set: { status, notes, correctionHistory } },
      { upsert: true, new: true },
    );

    // Recalculate subject aggregate totals from all records
    const allRecords = await AttendanceRecord.find({
      userId: req.user.id,
      subjectId,
      type,
    });
    const conducted = allRecords.filter(
      (r) => r.status === "present" || r.status === "absent",
    );
    const attended = allRecords.filter((r) => r.status === "present");

    if (type === "theory") {
      subject.totalTheorySessions = conducted.length;
      subject.attendedTheorySessions = attended.length;
    } else {
      subject.totalPracticalSessions = conducted.length;
      subject.attendedPracticalSessions = attended.length;
    }

    await subject.save();

    const analysis = AttendanceEngine.calculateAttendanceStatus(
      type === "theory"
        ? subject.attendedTheorySessions
        : subject.attendedPracticalSessions,
      type === "theory"
        ? subject.totalTheorySessions
        : subject.totalPracticalSessions,
      subject.targetAttendancePercent || 85,
    );

    return res.json({
      success: true,
      record,
      subject,
      analysis,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceHistory(req, res, next) {
  try {
    const { subjectId, date } = req.query;
    const filter = { userId: req.user.id };
    if (subjectId) filter.subjectId = subjectId;
    if (date) filter.date = date;

    const records = await AttendanceRecord.find(filter)
      .populate("subjectId", "name code type")
      .sort({ date: -1 });

    return res.json({ success: true, count: records.length, records });
  } catch (err) {
    next(err);
  }
}

export async function getAssignments(req, res, next) {
  try {
    const assignments = await Assignment.find({ userId: req.user.id })
      .populate("subjectId", "name code")
      .sort({ dueDate: 1, priority: 1 });
    return res.json({ success: true, count: assignments.length, assignments });
  } catch (err) {
    next(err);
  }
}

export async function createAssignment(req, res, next) {
  try {
    const {
      title,
      subjectId,
      dueDate,
      startDate = null,
      priority = "P1",
      estimatedMinutes = 60,
      description = "",
      workRequired = "",
      notes = "",
      reminderDaysBefore = [3, 2],
    } = req.body;
    if (
      !title ||
      !isDateKey(dueDate) ||
      (startDate && !isDateKey(startDate)) ||
      (startDate && startDate > dueDate)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Assignment title, valid dates, and a deadline on/after the start date are required.",
        });
    }
    if (
      subjectId &&
      !(await AcademicSubject.exists({ _id: subjectId, userId: req.user.id }))
    )
      return res
        .status(404)
        .json({ success: false, error: "Subject not found." });

    const assignment = await Assignment.create({
      userId: req.user.id,
      title: title.trim(),
      subjectId: subjectId || null,
      dueDate,
      startDate,
      priority,
      estimatedMinutes: Number(estimatedMinutes) || 60,
      description,
      workRequired,
      notes,
      reminderDaysBefore: normalizeReminderDays(reminderDaysBefore),
      changeHistory: [
        {
          action: "created",
          after: { title: title.trim(), dueDate, status: "pending" },
        },
      ],
    });

    return res.status(201).json({ success: true, assignment });
  } catch (err) {
    next(err);
  }
}

export async function updateAssignment(req, res, next) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.userId;
    const allowed = [
      "title",
      "subjectId",
      "dueDate",
      "startDate",
      "priority",
      "estimatedMinutes",
      "description",
      "workRequired",
      "notes",
      "reminderDaysBefore",
      "status",
    ];
    for (const key of Object.keys(updates))
      if (!allowed.includes(key)) delete updates[key];
    if (updates.dueDate !== undefined && !isDateKey(updates.dueDate))
      return res
        .status(400)
        .json({ success: false, error: "Valid deadline is required." });
    if (updates.startDate && !isDateKey(updates.startDate))
      return res
        .status(400)
        .json({ success: false, error: "Valid start date is required." });
    if (updates.subjectId) {
      const subject = await AcademicSubject.exists({
        _id: updates.subjectId,
        userId: req.user.id,
      });
      if (!subject)
        return res
          .status(404)
          .json({ success: false, error: "Subject not found." });
    }

    const assignment = await Assignment.findOne({
      _id: id,
      userId: req.user.id,
    });

    if (!assignment)
      return res
        .status(404)
        .json({ success: false, error: "Assignment not found." });
    if (
      (updates.startDate || assignment.startDate) &&
      (updates.dueDate || assignment.dueDate) &&
      (updates.startDate || assignment.startDate) >
        (updates.dueDate || assignment.dueDate)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Deadline must be on or after the start date.",
        });
    const before = Object.fromEntries(
      Object.keys(updates).map((key) => [key, assignment[key]]),
    );
    for (const [key, value] of Object.entries(updates))
      assignment[key] =
        key === "reminderDaysBefore" ? normalizeReminderDays(value) : value;
    assignment.changeHistory.push({
      action: updates.status === "cancelled" ? "cancelled" : "updated",
      before,
      after: updates,
    });
    await assignment.save();

    return res.json({ success: true, assignment });
  } catch (err) {
    next(err);
  }
}

export async function getExaminations(req, res, next) {
  try {
    const exams = await Examination.find({ userId: req.user.id }).sort({
      examDate: 1,
    });
    return res.json({ success: true, count: exams.length, exams });
  } catch (err) {
    next(err);
  }
}

export async function createExamination(req, res, next) {
  try {
    const {
      subjectName,
      subjectId,
      examType = "in-sem",
      examDate,
      endDate = null,
      affectedBlocks = [],
      priority = "P1",
      startTime = "10:00",
      durationMinutes = 120,
      syllabusTopics = [],
      targetMarks = 80,
      maxMarks = 100,
      notes = "",
    } = req.body;
    if (
      !subjectName ||
      !isDateKey(examDate) ||
      (endDate && (!isDateKey(endDate) || endDate < examDate))
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Examination title, valid start date, and valid end date on/after start are required.",
        });
    }
    if (
      subjectId &&
      !(await AcademicSubject.exists({ _id: subjectId, userId: req.user.id }))
    )
      return res
        .status(404)
        .json({ success: false, error: "Subject not found." });
    if (
      !Array.isArray(affectedBlocks) ||
      !(await validBlockIds(req.user.id, affectedBlocks))
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Select timetable blocks belonging to your schedule.",
        });

    const exam = await Examination.create({
      userId: req.user.id,
      subjectName: subjectName.trim(),
      subjectId: subjectId || null,
      examType,
      examDate,
      endDate,
      affectedBlocks: Array.isArray(affectedBlocks) ? affectedBlocks : [],
      priority,
      startTime,
      durationMinutes: Number(durationMinutes) || 120,
      syllabusTopics: Array.isArray(syllabusTopics)
        ? syllabusTopics
        : [syllabusTopics],
      targetMarks: Number(targetMarks) || 80,
      maxMarks: Number(maxMarks) || 100,
      notes,
      changeHistory: [
        {
          action: "created",
          after: {
            subjectName: subjectName.trim(),
            examDate,
            endDate,
            affectedBlocks,
            priority,
          },
        },
      ],
    });

    return res.status(201).json({ success: true, exam });
  } catch (err) {
    next(err);
  }
}

export async function updateExamination(req, res, next) {
  try {
    const updates = { ...req.body };
    const allowed = [
      "subjectName",
      "subjectId",
      "examType",
      "examDate",
      "endDate",
      "affectedBlocks",
      "priority",
      "startTime",
      "durationMinutes",
      "syllabusTopics",
      "targetMarks",
      "maxMarks",
      "notes",
      "status",
    ];
    for (const key of Object.keys(updates))
      if (!allowed.includes(key)) delete updates[key];
    if (updates.subjectId) {
      const subject = await AcademicSubject.exists({
        _id: updates.subjectId,
        userId: req.user.id,
      });
      if (!subject)
        return res
          .status(404)
          .json({ success: false, error: "Subject not found." });
    }
    if (updates.examDate && !isDateKey(updates.examDate))
      return res
        .status(400)
        .json({ success: false, error: "Valid examination date is required." });
    if (
      updates.endDate &&
      (!isDateKey(updates.endDate) ||
        (updates.examDate ||
          (
            await Examination.findOne({
              _id: req.params.id,
              userId: req.user.id,
            })
          )?.examDate) > updates.endDate)
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Examination end date must be on/after start date.",
        });
    if (
      updates.affectedBlocks !== undefined &&
      (!Array.isArray(updates.affectedBlocks) ||
        !(await validBlockIds(req.user.id, updates.affectedBlocks)))
    )
      return res
        .status(400)
        .json({
          success: false,
          error: "Select timetable blocks belonging to your schedule.",
        });
    const exam = await Examination.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!exam)
      return res
        .status(404)
        .json({ success: false, error: "Examination not found." });
    const before = Object.fromEntries(
      Object.keys(updates).map((key) => [key, exam[key]]),
    );
    for (const [key, value] of Object.entries(updates)) exam[key] = value;
    exam.changeHistory.push({ action: "updated", before, after: updates });
    await exam.save();
    return res.json({ success: true, exam });
  } catch (err) {
    next(err);
  }
}

export async function deleteExamination(req, res, next) {
  try {
    const exam = await Examination.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!exam)
      return res
        .status(404)
        .json({ success: false, error: "Examination not found." });
    const before = {
      status: exam.status,
      subjectName: exam.subjectName,
      examDate: exam.examDate,
      endDate: exam.endDate,
    };
    exam.status = "cancelled";
    exam.changeHistory.push({
      action: "cancelled",
      before,
      after: { status: "cancelled" },
    });
    await exam.save();
    return res.json({ success: true, exam });
  } catch (err) {
    next(err);
  }
}

function normalizeReminderDays(value) {
  const days = (Array.isArray(value) ? value : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30);
  return [...new Set(days)].sort((a, b) => b - a);
}

function isDateKey(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

async function validBlockIds(userId, blockIds) {
  const wanted = [...new Set(blockIds.map(String))];
  if (wanted.length !== blockIds.length) return false;
  if (!wanted.length) return true;
  const templates = await (
    await import("../models/ScheduleTemplate.js")
  ).ScheduleTemplate.find({ userId })
    .select("blocks.blockId")
    .lean();
  const available = new Set(
    templates.flatMap((t) => (t.blocks || []).map((b) => b.blockId)),
  );
  return wanted.every((id) => available.has(id));
}

export async function toggleExamMode(req, res, next) {
  try {
    const { enabled, focusSubjects = [] } = req.body;

    const setting = await Setting.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          examModeEnabled: Boolean(enabled),
          examModeFocusSubjects: focusSubjects,
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    return res.json({
      success: true,
      message: enabled
        ? "Exam Mode activated. Academic blocks and revision sessions are prioritised without deleting your other course progress."
        : "Exam Mode deactivated. Normal balanced daily schedule restored.",
      examModeEnabled: setting.examModeEnabled,
      focusSubjects: setting.examModeFocusSubjects,
    });
  } catch (err) {
    next(err);
  }
}

export async function getExamPrepSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const settings = (await Setting.findOne({ userId })) || {
      examPreparationAllowanceSemester: 15,
      examPreparationMaxPerMonth: 7,
    };
    const maxSemester = settings.examPreparationAllowanceSemester || 15;
    const maxMonth = settings.examPreparationMaxPerMonth || 7;

    const exams = await Examination.find({ userId });
    const allPrepDates = [];
    const monthUsage = {};

    for (const exam of exams) {
      if (exam.preparationDates && exam.preparationDates.length > 0) {
        for (const p of exam.preparationDates) {
          allPrepDates.push({
            examId: exam._id,
            subjectName: exam.subjectName,
            date: p.date,
            templateOverride: p.templateOverride,
            notes: p.notes,
          });
          const mKey = p.date.slice(0, 7);
          monthUsage[mKey] = (monthUsage[mKey] || 0) + 1;
        }
      }
    }

    allPrepDates.sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      success: true,
      allowanceSemester: maxSemester,
      usedSemester: allPrepDates.length,
      remainingSemester: Math.max(0, maxSemester - allPrepDates.length),
      maxPerMonth: maxMonth,
      monthUsage,
      preparationDates: allPrepDates,
    });
  } catch (err) {
    next(err);
  }
}

export async function addExamPrepDate(req, res, next) {
  try {
    const { id } = req.params;
    const { date, templateOverride = "holiday", notes = "" } = req.body;
    const userId = req.user.id;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Valid date (YYYY-MM-DD) is required.",
        });
    }

    const exam = await Examination.findOne({ _id: id, userId });
    if (!exam) {
      return res
        .status(404)
        .json({ success: false, error: "Examination not found." });
    }

    const settings = (await Setting.findOne({ userId })) || {
      examPreparationAllowanceSemester: 15,
      examPreparationMaxPerMonth: 7,
    };
    const maxSemester = settings.examPreparationAllowanceSemester || 15;
    const maxMonth = settings.examPreparationMaxPerMonth || 7;

    const allExams = await Examination.find({ userId });
    let totalSemesterDates = 0;
    let monthDatesCount = 0;
    const targetMonth = date.slice(0, 7);

    for (const e of allExams) {
      if (e.preparationDates) {
        for (const p of e.preparationDates) {
          totalSemesterDates++;
          if (p.date.slice(0, 7) === targetMonth) {
            monthDatesCount++;
          }
          if (p.date === date) {
            return res
              .status(400)
              .json({
                success: false,
                error: `Date ${date} is already scheduled as an exam preparation day.`,
              });
          }
        }
      }
    }

    if (totalSemesterDates >= maxSemester) {
      return res.status(400).json({
        success: false,
        error: `Semester exam preparation allowance exhausted (${totalSemesterDates}/${maxSemester} days used).`,
      });
    }

    if (monthDatesCount >= maxMonth) {
      return res.status(400).json({
        success: false,
        error: `Monthly preparation day limit reached for ${targetMonth} (${monthDatesCount}/${maxMonth} days used). Maximum 7 preparation days allowed per calendar month.`,
      });
    }

    exam.preparationDates.push({
      date,
      templateOverride: templateOverride || "holiday",
      notes: notes || `Preparation for ${exam.subjectName}`,
    });
    await exam.save();

    await ScheduleException.findOneAndUpdate(
      { userId, date },
      {
        $set: {
          exceptionType: "exam_leave",
          templateOverride: templateOverride || "holiday",
          notes:
            notes || `Exam Prep Leave: ${exam.subjectName} (${exam.examType})`,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    return res.status(201).json({
      success: true,
      message: `Exam preparation day scheduled for ${date} with ${templateOverride} timetable template.`,
      exam,
    });
  } catch (err) {
    next(err);
  }
}

export async function removeExamPrepDate(req, res, next) {
  try {
    const { id, date } = req.params;
    const userId = req.user.id;

    const exam = await Examination.findOne({ _id: id, userId });
    if (!exam) {
      return res
        .status(404)
        .json({ success: false, error: "Examination not found." });
    }

    exam.preparationDates = (exam.preparationDates || []).filter(
      (p) => p.date !== date,
    );
    await exam.save();

    await ScheduleException.deleteOne({
      userId,
      date,
      exceptionType: "exam_leave",
    });

    return res.json({
      success: true,
      message: `Exam preparation date ${date} removed.`,
    });
  } catch (err) {
    next(err);
  }
}
