import mongoose from 'mongoose';

const hackathonSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  tagline: { type: String, default: '' },
  theme: { type: String, default: '' },
  startDate: { type: String, required: true }, // YYYY-MM-DD
  endDate: { type: String, required: true },   // YYYY-MM-DD
  registrationDeadline: { type: String },
  currentStage: { 
    type: String, 
    enum: ['registered', 'ideation', 'proposal', 'prototype', 'demo', 'pitch', 'completed'], 
    default: 'registered' 
  },
  teamMembers: [{
    name: { type: String, required: true },
    role: { type: String, required: true },
    contact: { type: String, default: '' }
  }],
  stages: [{
    name: { type: String, required: true },
    deadline: { type: String },
    status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
    deliverable: { type: String, default: '' }
  }],
  weeklyEffortBudgetHours: { type: Number, default: 10 },
  repoUrl: { type: String, default: '' },
  liveDemoUrl: { type: String, default: '' },
  pitchDeckUrl: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const Hackathon = mongoose.models.Hackathon || mongoose.model('Hackathon', hackathonSchema);
