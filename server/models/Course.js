import mongoose from 'mongoose';

const lectureSchema = new mongoose.Schema({
  lectureNumber: { type: Number, required: true },
  title: { type: String, required: true },
  videoDurationMinutes: { type: Number, default: 0 },
  practiceMultiplier: { type: Number, default: 1.6 },
  totalEffortMinutes: { type: Number, default: 0 },
  isWatched: { type: Boolean, default: false },
  isCodeDone: { type: Boolean, default: false },
  problemsAttempted: { type: Number, default: 0 },
  problemsSolved: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  confidence: { type: Number, min: 1, max: 5, default: 3 },
  notes: { type: String, default: '' },
  completedAt: { type: Date }
}, { _id: true });

const sectionSchema = new mongoose.Schema({
  sectionNumber: { type: Number, required: true },
  title: { type: String, required: true },
  lectures: [lectureSchema]
}, { _id: true });

const courseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  slug: { type: String, required: true, index: true }, // 'web-dev', 'dsa', 'exploration'
  title: { type: String, required: true },
  instructor: { type: String, default: '' },
  description: { type: String, default: '' },
  defaultPracticeMultiplier: { type: Number, default: 1.6 },
  sections: [sectionSchema],
  totalLectures: { type: Number, default: 0 },
  completedLectures: { type: Number, default: 0 },
  totalMinutes: { type: Number, default: 0 },
  completedMinutes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

courseSchema.index({ userId: 1, slug: 1 }, { unique: true });

courseSchema.methods.recalculateProgress = function() {
  let total = 0;
  let done = 0;
  let totalMin = 0;
  let doneMin = 0;

  for (const sec of this.sections) {
    for (const lec of sec.lectures) {
      total++;
      const effort = lec.totalEffortMinutes || Math.round(lec.videoDurationMinutes * (lec.practiceMultiplier || 1.6));
      totalMin += effort;
      if (lec.isWatched && lec.isCodeDone) {
        done++;
        doneMin += effort;
      }
    }
  }

  this.totalLectures = total;
  this.completedLectures = done;
  this.totalMinutes = totalMin;
  this.completedMinutes = doneMin;
  this.updatedAt = new Date();
};

export const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
