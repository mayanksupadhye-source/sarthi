import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { 
    type: String, 
    enum: ['movie', 'trekking', 'treat', 'friends', 'entertainment', 'other'], 
    default: 'treat' 
  },
  unlockCriteria: { type: String, required: true },
  isUnlocked: { type: Boolean, default: false },
  unlockedAt: { type: Date },
  isRedeemed: { type: Boolean, default: false },
  redeemedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const savingsEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  goalTitle: { type: String, default: 'Mountain Trekking / 20th Birthday Trip (₹4,000)' },
  targetAmount: { type: Number, default: 4000 },
  contributions: [{
    date: { type: String, required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    source: { type: String, default: 'personal-savings' }
  }],
  createdAt: { type: Date, default: Date.now }
});

savingsEntrySchema.virtual('totalSaved').get(function() {
  if (!this.contributions || this.contributions.length === 0) return 0;
  return this.contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
});

savingsEntrySchema.virtual('remainingAmount').get(function() {
  const total = this.totalSaved;
  return Math.max(0, this.targetAmount - total);
});

savingsEntrySchema.virtual('progressPercent').get(function() {
  if (this.targetAmount <= 0) return 100;
  return Math.min(100, Math.round((this.totalSaved / this.targetAmount) * 100));
});

savingsEntrySchema.set('toJSON', { virtuals: true });
savingsEntrySchema.set('toObject', { virtuals: true });

export const Reward = mongoose.models.Reward || mongoose.model('Reward', rewardSchema);
export const SavingsEntry = mongoose.models.SavingsEntry || mongoose.model('SavingsEntry', savingsEntrySchema);
