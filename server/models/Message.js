import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  text: {
    type: String,
    required: true
  },
  contexts: [{
    type: String,
    index: true
  }],
  tone: {
    type: String,
    default: 'calm'
  },
  patternTags: [{
    type: String
  }],
  surfaces: [{
    type: String,
    index: true
  }],
  cooldownDays: {
    type: Number,
    default: 3
  },
  maxPerWeek: {
    type: Number,
    default: 3
  },
  conditions: [{
    type: String
  }],
  weight: {
    type: Number,
    default: 1.0
  },
  userFeedback: {
    thumbsUp: { type: Number, default: 0 },
    thumbsDown: { type: Number, default: 0 }
  },
  lastShownAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export const Message = mongoose.model('Message', messageSchema);
