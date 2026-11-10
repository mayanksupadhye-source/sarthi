import mongoose from 'mongoose';

const marketConceptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    enum: ['equity-basics', 'fundamental-analysis', 'technical-analysis', 'risk-management', 'market-terms'], 
    default: 'equity-basics' 
  },
  notes: { type: String, default: '' },
  keyRule: { type: String, default: '' },
  paperLogs: [{
    date: { type: String, required: true },
    symbol: { type: String, required: true },
    hypothesis: { type: String, required: true },
    entryPrice: { type: Number, required: true },
    targetPrice: { type: Number },
    stopLossPrice: { type: Number },
    outcome: { type: String, enum: ['active', 'target-hit', 'stopped-out', 'closed-manual'], default: 'active' },
    lessonLearned: { type: String, default: '' }
  }],
  isUnderstood: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const MarketConcept = mongoose.models.MarketConcept || mongoose.model('MarketConcept', marketConceptSchema);
