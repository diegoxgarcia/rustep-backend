const mongoose = require('mongoose');

const stepsDistributionSchema = new mongoose.Schema({
  minute: {
    type: Number,
    required: true
  },
  steps: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const stepsLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stepsCount: {
    type: Number,
    required: true,
    min: 0
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  sessionDurationMinutes: {
    type: Number,
    required: true,
    min: 1
  },
  confidenceScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0
  },
  confidenceStatus: {
    type: String,
    enum: ['valid', 'suspicious', 'blocked'],
    default: 'valid'
  },
  gpsVarianceMeters: {
    type: Number,
    default: null
  },
  avgSpeedKmh: {
    type: Number,
    default: null
  },
  stepsDistribution: [stepsDistributionSchema],
  staminaCredited: {
    type: Number,
    default: 0
  },
  staminaCreditedAt: {
    type: Date,
    default: null
  },
  syncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes
stepsLogSchema.index({ userId: 1, startTime: -1 });
stepsLogSchema.index({ userId: 1, confidenceStatus: 1 });
stepsLogSchema.index({ startTime: 1 });
stepsLogSchema.index({ confidenceStatus: 1 });

// Pre-save hook to calculate session duration
stepsLogSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('startTime') || this.isModified('endTime')) {
    const duration = (this.endTime - this.startTime) / (1000 * 60); // Convert to minutes
    this.sessionDurationMinutes = Math.max(1, Math.round(duration));
  }
  next();
});

// Static method to get user's total steps
stepsLogSchema.statics.getUserTotalSteps = async function(userId, confidenceFilter = null) {
  const match = { userId };

  if (confidenceFilter) {
    match.confidenceStatus = confidenceFilter;
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSteps: { $sum: '$stepsCount' },
        totalSessions: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { totalSteps: 0, totalSessions: 0 };
};

// Static method to get steps by date range
stepsLogSchema.statics.getStepsByDateRange = async function(userId, startDate, endDate) {
  return await this.find({
    userId,
    startTime: { $gte: startDate, $lte: endDate },
    confidenceStatus: { $ne: 'blocked' }
  }).sort({ startTime: -1 });
};

const StepsLog = mongoose.model('StepsLog', stepsLogSchema);

module.exports = StepsLog;
