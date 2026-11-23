const mongoose = require('mongoose');

/**
 * Pending browser login for Rustep Run (desktop game).
 *
 * Flow: the game creates a session (POST /game/auth/start), opens the browser on
 * /game/auth/google?sid=..., Google redirects back to /game/auth/callback, and the
 * game polls /game/auth/poll with its pollSecret until the session is "done".
 *
 * Only a hash of the pollSecret is stored, and tokens are never stored: they are
 * minted when the game collects a "done" session, which is then deleted.
 * MongoDB removes expired documents automatically (TTL index on expiresAt).
 */
const gameLoginSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  pollSecretHash: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'done', 'denied'],
    default: 'pending'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// TTL: Mongo deletes the document once expiresAt is in the past (checked ~every 60 s,
// so handlers must also compare expiresAt themselves).
gameLoginSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const GameLoginSession = mongoose.model('GameLoginSession', gameLoginSessionSchema);

module.exports = GameLoginSession;
