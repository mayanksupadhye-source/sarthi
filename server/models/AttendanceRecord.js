import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSubject', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  type: { type: String, enum: ['theory', 'practical'], default: 'theory' },
  status: { type: String, enum: ['present', 'absent', 'cancelled', 'exempted'], required: true },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

attendanceRecordSchema.index({ userId: 1, subjectId: 1, date: 1, type: 1 }, { unique: true });

export const AttendanceRecord = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', attendanceRecordSchema);
