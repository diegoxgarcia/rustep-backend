const mongoose = require('mongoose');

const fraudFlagSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  suspiciousSessions: {
    type: Number,
    default: 0
  },
  blockedSessions: {
    type: Number,
    default: 0
  },
  avgConfidenceScore: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 1
  },
  lastSuspiciousAt: {
    type: Date,
    default: null
  },
  reviewStatus: {
    type: String,
    enum: ['pending', 'under_review', 'cleared', 'confirmed_fraud'],
    default: 'pending'
  },
  reviewedBy: {
    type: String,
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNotes: {
    type: String,
    default: null
  },
  staminaFrozen: {
    type: Boolean,
    default: false
  },
  suspensionEndsAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
fraudFlagSchema.index({ reviewStatus: 1 });
fraudFlagSchema.index({ staminaFrozen: 1 });
fraudFlagSchema.index({ avgConfidenceScore: 1 });

// Method to calculate fraud risk level
fraudFlagSchema.methods.getFraudRiskLevel = function() {
  const suspiciousRate = this.totalSessions > 0
    ? this.suspiciousSessions / this.totalSessions
    : 0;

  if (this.avgConfidenceScore < 0.3 || suspiciousRate > 0.5) {
    return 'high';
  } else if (this.avgConfidenceScore < 0.5 || suspiciousRate > 0.25) {
    return 'medium';
  } else {
    return 'low';
  }
};

// Static method to update fraud stats
fraudFlagSchema.statics.updateFraudStats = async function(userId, sessionData) {
  const { confidenceScore, confidenceStatus } = sessionData;

  let fraudFlag = await this.findOne({ userId });

  if (!fraudFlag) {
    fraudFlag = new this({
      userId,
      totalSessions: 1,
      suspiciousSessions: confidenceStatus === 'suspicious' ? 1 : 0,
      blockedSessions: confidenceStatus === 'blocked' ? 1 : 0,
      avgConfidenceScore: confidenceScore
    });
  } else {
    fraudFlag.totalSessions += 1;

    if (confidenceStatus === 'suspicious') {
      fraudFlag.suspiciousSessions += 1;
      fraudFlag.lastSuspiciousAt = new Date();
    }

    if (confidenceStatus === 'blocked') {
      fraudFlag.blockedSessions += 1;
      fraudFlag.lastSuspiciousAt = new Date();
    }

    // Update average confidence score
    fraudFlag.avgConfidenceScore =
      (fraudFlag.avgConfidenceScore * (fraudFlag.totalSessions - 1) + confidenceScore) /
      fraudFlag.totalSessions;
  }

  return await fraudFlag.save();
};

const FraudFlag = mongoose.model('FraudFlag', fraudFlagSchema);

module.exports = FraudFlag;
