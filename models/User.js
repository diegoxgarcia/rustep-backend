const mongoose = require('mongoose');

const weeklyStepsSchema = new mongoose.Schema({
  weekNumber: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  totalSteps: {
    type: Number,
    default: 0
  },
  sessions: {
    type: Number,
    default: 0
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  photoUrl: {
    type: String,
    default: null
  },
  age: {
    type: Number,
    min: 13,
    max: 120,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: null
  },
  city: {
    type: String,
    trim: true,
    default: null
  },
  country: {
    type: String,
    trim: true,
    default: null
  },
  activityCategory: {
    type: String,
    enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
    default: 'sedentary'
  },
  spotifyPlaylistUrl: {
    type: String,
    default: null
  },
  showSpotifyPlaylist: {
    type: Boolean,
    default: false
  },
  weeklyStepsHistory: [weeklyStepsSchema],
  lastActive: {
    type: Date,
    default: Date.now
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'banned'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ createdAt: -1 });

// Virtual for total career steps (can be calculated from steps_log)
userSchema.virtual('totalCareerSteps', {
  ref: 'StepsLog',
  localField: '_id',
  foreignField: 'userId',
  count: false,
  match: { confidenceStatus: { $ne: 'blocked' } }
});

// Method to update last active
userSchema.methods.updateLastActive = function() {
  this.lastActive = Date.now();
  return this.save();
};

// Method to add weekly steps
userSchema.methods.addWeeklySteps = function(weekNumber, year, stepsCount) {
  const existingWeek = this.weeklyStepsHistory.find(
    w => w.weekNumber === weekNumber && w.year === year
  );

  if (existingWeek) {
    existingWeek.totalSteps += stepsCount;
    existingWeek.sessions += 1;
  } else {
    this.weeklyStepsHistory.push({
      weekNumber,
      year,
      totalSteps: stepsCount,
      sessions: 1
    });
  }

  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
