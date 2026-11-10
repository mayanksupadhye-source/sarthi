import mongoose from 'mongoose';

const examinationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSubject' },
  subjectName: { type: String, required: true },
  examType: { 
    type: String, 
    enum: ['class-test', 'in-sem', 'end-sem', 'practical-viva'], 
    default: 'in-sem' 
  },
  examDate: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, default: '10:00' },
  durationMinutes: { type: Number, default: 120 },
  syllabusTopics: [{ type: String }],
  revisionTargetPercent: { type: Number, default: 100 },
  currentRevisionPercent: { type: Number, default: 0 },
  weightagePercent: { type: Number, default: 20 },
  marksObtained: { type: Number },
  maxMarks: { type: Number, default: 100 },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const Examination = mongoose.models.Examination || mongoose.model('Examination', examinationSchema);
