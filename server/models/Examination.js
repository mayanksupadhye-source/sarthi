import mongoose from "mongoose";

const examinationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSubject" },
  subjectName: { type: String, required: true },
  examType: {
    type: String,
    enum: ["class-test", "in-sem", "end-sem", "practical-viva"],
    default: "in-sem",
  },
  examDate: { type: String, required: true }, // YYYY-MM-DD
  endDate: { type: String, default: null },
  affectedBlocks: [{ type: String }],
  priority: { type: String, enum: ["P1", "P2", "P3"], default: "P1" },
  startTime: { type: String, default: "10:00" },
  durationMinutes: { type: Number, default: 120 },
  syllabusTopics: [{ type: String }],
  revisionTargetPercent: { type: Number, default: 100 },
  currentRevisionPercent: { type: Number, default: 0 },
  weightagePercent: { type: Number, default: 20 },
  marksObtained: { type: Number },
  maxMarks: { type: Number, default: 100 },
  notes: { type: String, default: "" },
  status: {
    type: String,
    enum: ["scheduled", "cancelled", "completed"],
    default: "scheduled",
    index: true,
  },
  changeHistory: [
    {
      action: { type: String, enum: ["created", "updated", "cancelled"] },
      changedAt: { type: Date, default: Date.now },
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  ],
  semester: { type: String, default: "current", index: true },
  preparationDates: [
    {
      date: { type: String, required: true }, // YYYY-MM-DD
      templateOverride: { type: String, default: "holiday" },
      notes: { type: String, default: "" },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

export const Examination =
  mongoose.models.Examination ||
  mongoose.model("Examination", examinationSchema);
