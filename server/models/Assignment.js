import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSubject' },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  dueDate: { type: String, required: true }, // YYYY-MM-DD
  estimatedMinutes: { type: Number, default: 60 },
  priority: { type: String, enum: ['P1', 'P2', 'P3'], default: 'P1' },
  status: { type: String, enum: ['assigned', 'in-progress', 'submitted', 'graded'], default: 'assigned' },
  submissionLink: { type: String, default: '' },
  marksObtained: { type: Number },
  maxMarks: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now }
});

export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
