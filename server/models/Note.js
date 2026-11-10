import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, default: '' },
  type: { 
    type: String, 
    enum: ['journal', 'note', 'reflection', 'reset-room', 'history', 'learning'], 
    default: 'note',
    index: true 
  },
  date: { type: String, index: true }, // YYYY-MM-DD
  tags: [{ type: String, trim: true }],
  mood: { type: String, enum: ['grounded', 'focused', 'tired', 'restless', 'optimistic', 'reflective', 'neutral'], default: 'neutral' },
  nextSingleAction: { type: String, default: '' },
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

noteSchema.index({ userId: 1, title: 'text', content: 'text', tags: 'text' });

export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
