import mongoose from "mongoose";

const lectureSchema = new mongoose.Schema(
  {
    lectureNumber: { type: Number, required: true },
    title: { type: String, required: true },
    videoDurationMinutes: { type: Number, default: 0 },
    practiceMultiplier: { type: Number, default: 2.0 },
    totalEffortMinutes: { type: Number, default: 0 },
    isWatched: { type: Boolean, default: false },
    isCodeDone: { type: Boolean, default: false },
    problemsAttempted: { type: Number, default: 0 },
    problemsSolved: { type: Number, default: 0 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    confidence: { type: Number, min: 1, max: 5, default: 3 },
    notes: { type: String, default: "" },
    completedAt: { type: Date },
  },
  { _id: true },
);

const sectionSchema = new mongoose.Schema(
  {
    sectionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    lectures: [lectureSchema],
  },
  { _id: true },
);

const courseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  slug: { type: String, required: true, index: true }, // 'web-dev', 'dsa', 'exploration'
  title: { type: String, required: true },
  emoji: { type: String, default: "📚" },
  category: { type: String, default: "course", index: true }, // 'course', 'exploration', 'oratory', 'academic'
  priority: { type: String, enum: ["P1", "P2", "P3"], default: "P2" },
  instructor: { type: String, default: "" },
  description: { type: String, default: "" },
  notes: { type: String, default: "" },
  defaultPracticeMultiplier: { type: Number, default: 2.0 },
  status: {
    type: String,
    enum: ["active", "paused", "archived"],
    default: "active",
    index: true,
  },
  startDate: { type: String }, // "YYYY-MM-DD"
  targetDate: { type: String }, // "YYYY-MM-DD"
  sections: [sectionSchema],
  totalHours: { type: Number, default: 0 },
  totalLectures: { type: Number, default: 0 },
  completedLectures: { type: Number, default: 0 },
  totalMinutes: { type: Number, default: 0 },
  completedMinutes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

courseSchema.index({ userId: 1, slug: 1 }, { unique: true });

courseSchema.methods.syncFromActivities = function (activities = []) {
  if (!activities || activities.length === 0) return;
  this.totalLectures = activities.length;
  this.completedLectures = activities.filter(
    (a) => a.status === "completed" || (a.isWatched && a.isCodeDone)
  ).length;
  this.totalMinutes = Math.round(
    activities.reduce((s, a) => s + (a.totalEffortMinutes || 0), 0)
  );
  this.completedMinutes = Math.round(
    activities
      .filter((a) => a.status === "completed" || (a.isWatched && a.isCodeDone))
      .reduce((s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0), 0)
  );
  this.totalHours = Math.round((this.totalMinutes / 60) * 10) / 10;
  if (this.totalLectures > 0 && this.completedLectures >= this.totalLectures) {
    this.status = "archived";
  } else if (this.status === "archived" && this.completedLectures < this.totalLectures) {
    this.status = "active";
  }
  this.updatedAt = new Date();
};

courseSchema.methods.recalculateProgress = function () {
  let total = 0;
  let done = 0;
  let totalMin = 0;
  let doneMin = 0;

  if (this.sections && this.sections.length > 0) {
    for (const sec of this.sections) {
      for (const lec of sec.lectures) {
        total++;
        const mult =
          lec.practiceMultiplier || this.defaultPracticeMultiplier || 2.0;
        const effort =
          lec.totalEffortMinutes || Math.round(lec.videoDurationMinutes * mult);
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
    this.totalHours = Math.round((totalMin / 60) * 10) / 10;
  } else {
    // Preserve manual hours / minutes and existing lecture counts when no embedded sections exist
    if (this.totalHours && this.totalHours > 0 && !this.totalMinutes) {
      this.totalMinutes = Math.round(this.totalHours * 60);
    } else if (this.totalMinutes && this.totalMinutes > 0 && !this.totalHours) {
      this.totalHours = Math.round((this.totalMinutes / 60) * 10) / 10;
    }
  }
  this.updatedAt = new Date();
};

export const Course =
  mongoose.models.Course || mongoose.model("Course", courseSchema);
