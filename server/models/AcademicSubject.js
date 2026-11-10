import mongoose from 'mongoose';

const academicSubjectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['theory', 'practical', 'both'], default: 'theory' },
  faculty: { type: String, default: '' },
  room: { type: String, default: '' },
  minimumAttendancePercent: { type: Number, default: 75 },
  targetAttendancePercent: { type: Number, default: 80 },
  totalTheorySessions: { type: Number, default: 0 },
  attendedTheorySessions: { type: Number, default: 0 },
  totalPracticalSessions: { type: Number, default: 0 },
  attendedPracticalSessions: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

academicSubjectSchema.virtual('theoryAttendancePercent').get(function() {
  if (this.totalTheorySessions === 0) return 100;
  return Math.round((this.attendedTheorySessions / this.totalTheorySessions) * 100);
});

academicSubjectSchema.virtual('practicalAttendancePercent').get(function() {
  if (this.totalPracticalSessions === 0) return 100;
  return Math.round((this.attendedPracticalSessions / this.totalPracticalSessions) * 100);
});

academicSubjectSchema.set('toJSON', { virtuals: true });
academicSubjectSchema.set('toObject', { virtuals: true });

export const AcademicSubject = mongoose.models.AcademicSubject || mongoose.model('AcademicSubject', academicSubjectSchema);
