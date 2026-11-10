import { AcademicSubject } from '../models/AcademicSubject.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { Assignment } from '../models/Assignment.js';
import { Examination } from '../models/Examination.js';
import { Setting } from '../models/Setting.js';
import { AttendanceEngine } from '../services/attendanceEngine.js';

export async function getSubjects(req, res, next) {
  try {
    const subjects = await AcademicSubject.find({ userId: req.user.id });
    
    // Enrich with computed status
    const enriched = subjects.map(s => {
      const theoryStatus = AttendanceEngine.calculateAttendanceStatus(
        s.attendedTheorySessions,
        s.totalTheorySessions,
        s.targetAttendancePercent || 75
      );
      const practicalStatus = s.type !== 'theory' ? AttendanceEngine.calculateAttendanceStatus(
        s.attendedPracticalSessions,
        s.totalPracticalSessions,
        s.targetAttendancePercent || 75
      ) : null;

      return {
        ...s.toObject(),
        theoryStatus,
        practicalStatus
      };
    });

    return res.json({ success: true, count: enriched.length, subjects: enriched });
  } catch (err) {
    next(err);
  }
}

export async function createSubject(req, res, next) {
  try {
    const { code, name, type = 'theory', faculty = '', room = '', minimumAttendancePercent = 75, targetAttendancePercent = 80 } = req.body;

    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Subject code and name are required.' });
    }

    const subject = await AcademicSubject.create({
      userId: req.user.id,
      code: code.trim(),
      name: name.trim(),
      type,
      faculty: faculty.trim(),
      room: room.trim(),
      minimumAttendancePercent: Number(minimumAttendancePercent) || 75,
      targetAttendancePercent: Number(targetAttendancePercent) || 80
    });

    return res.status(201).json({ success: true, subject });
  } catch (err) {
    next(err);
  }
}

export async function markAttendance(req, res, next) {
  try {
    const { subjectId, date, type = 'theory', status, notes = '' } = req.body;

    if (!subjectId || !date || !status) {
      return res.status(400).json({ success: false, error: 'SubjectId, date, and status are required.' });
    }

    const subject = await AcademicSubject.findOne({ _id: subjectId, userId: req.user.id });
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found.' });
    }

    // Upsert record
    const record = await AttendanceRecord.findOneAndUpdate(
      { userId: req.user.id, subjectId, date, type },
      { $set: { status, notes } },
      { upsert: true, new: true }
    );

    // Recalculate subject aggregate totals from all records
    const allRecords = await AttendanceRecord.find({ userId: req.user.id, subjectId, type });
    const conducted = allRecords.filter(r => r.status === 'present' || r.status === 'absent');
    const attended = allRecords.filter(r => r.status === 'present');

    if (type === 'theory') {
      subject.totalTheorySessions = conducted.length;
      subject.attendedTheorySessions = attended.length;
    } else {
      subject.totalPracticalSessions = conducted.length;
      subject.attendedPracticalSessions = attended.length;
    }

    await subject.save();

    const analysis = AttendanceEngine.calculateAttendanceStatus(
      type === 'theory' ? subject.attendedTheorySessions : subject.attendedPracticalSessions,
      type === 'theory' ? subject.totalTheorySessions : subject.totalPracticalSessions,
      subject.targetAttendancePercent || 75
    );

    return res.json({
      success: true,
      record,
      subject,
      analysis
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
      .populate('subjectId', 'name code type')
      .sort({ date: -1 });

    return res.json({ success: true, count: records.length, records });
  } catch (err) {
    next(err);
  }
}

export async function getAssignments(req, res, next) {
  try {
    const assignments = await Assignment.find({ userId: req.user.id })
      .populate('subjectId', 'name code')
      .sort({ dueDate: 1, priority: 1 });
    return res.json({ success: true, count: assignments.length, assignments });
  } catch (err) {
    next(err);
  }
}

export async function createAssignment(req, res, next) {
  try {
    const { title, subjectId, dueDate, priority = 'P1', estimatedMinutes = 60, description = '' } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ success: false, error: 'Assignment title and due date are required.' });
    }

    const assignment = await Assignment.create({
      userId: req.user.id,
      title: title.trim(),
      subjectId: subjectId || null,
      dueDate,
      priority,
      estimatedMinutes: Number(estimatedMinutes) || 60,
      description
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

    const assignment = await Assignment.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: updates },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found.' });
    }

    return res.json({ success: true, assignment });
  } catch (err) {
    next(err);
  }
}

export async function getExaminations(req, res, next) {
  try {
    const exams = await Examination.find({ userId: req.user.id })
      .sort({ examDate: 1 });
    return res.json({ success: true, count: exams.length, exams });
  } catch (err) {
    next(err);
  }
}

export async function createExamination(req, res, next) {
  try {
    const { subjectName, examType = 'in-sem', examDate, startTime = '10:00', durationMinutes = 120, syllabusTopics = [], targetMarks = 80, maxMarks = 100 } = req.body;
    if (!subjectName || !examDate) {
      return res.status(400).json({ success: false, error: 'Subject name and exam date are required.' });
    }

    const exam = await Examination.create({
      userId: req.user.id,
      subjectName: subjectName.trim(),
      examType,
      examDate,
      startTime,
      durationMinutes: Number(durationMinutes) || 120,
      syllabusTopics: Array.isArray(syllabusTopics) ? syllabusTopics : [syllabusTopics],
      targetMarks: Number(targetMarks) || 80,
      maxMarks: Number(maxMarks) || 100
    });

    return res.status(201).json({ success: true, exam });
  } catch (err) {
    next(err);
  }
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
          updatedAt: new Date()
        } 
      },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: enabled 
        ? 'Exam Mode activated. Academic blocks and revision sessions are prioritised without deleting your other course progress.' 
        : 'Exam Mode deactivated. Normal balanced daily schedule restored.',
      examModeEnabled: setting.examModeEnabled,
      focusSubjects: setting.examModeFocusSubjects
    });
  } catch (err) {
    next(err);
  }
}
