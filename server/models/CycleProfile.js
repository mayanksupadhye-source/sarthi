import mongoose from 'mongoose';

const cycleProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  displayName: { type: String, default: 'Rashi', trim: true, maxlength: 60 },
  cycleLengthEstimateDays: { type: Number, default: 28, min: 15, max: 60 },
  cycleLengthPreferenceDays: { type: Number, default: 28, min: 15, max: 60 },
  periodLengthEstimateDays: { type: Number, default: 5, min: 1, max: 10 },
  timezone: { type: String, default: 'Asia/Kolkata' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const CycleProfile = mongoose.models.CycleProfile || mongoose.model('CycleProfile', cycleProfileSchema);
