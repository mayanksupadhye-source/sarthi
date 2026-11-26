import mongoose from "mongoose";

const timetableActivationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  profileId: {
    type: String,
    required: true,
    enum: ["weekday", "saturday", "sunday", "holiday", "exam", "custom"],
  },
  startDate: {
    type: String, // YYYY-MM-DD in Asia/Kolkata
    required: true,
    index: true,
  },
  endDate: {
    type: String, // YYYY-MM-DD in Asia/Kolkata
    required: true,
    index: true,
  },
  notes: {
    type: String,
    default: "",
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

timetableActivationSchema.index({ userId: 1, startDate: 1, endDate: 1 });

export const TimetableActivation =
  mongoose.models.TimetableActivation ||
  mongoose.model("TimetableActivation", timetableActivationSchema);
