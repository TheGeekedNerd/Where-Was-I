const mongoose = require('mongoose')

/**
 * ActivityLog
 * Written whenever a meaningful game event occurs:
 *   - mission_completed  → POST /progress/:rawgId/complete
 *   - game_started       → PATCH /library/:rawgId/status → 'playing' (first time)
 *   - game_paused        → PATCH /library/:rawgId/status → 'paused'
 *   - game_completed     → PATCH /library/:rawgId/status → 'completed'
 *   - game_resumed       → PATCH /library/:rawgId/status → 'playing' (was paused)
 */
const activityLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rawgId:    { type: Number, required: true },
  gameTitle: { type: String, required: true },
  cover:     { type: String },           // cover image URL for the game card thumbnail
  eventType: {
    type:     String,
    required: true,
    enum:     ['mission_completed', 'game_started', 'game_paused', 'game_completed', 'game_resumed'],
  },
  label:     { type: String, required: true },  // human-readable e.g. "Completed The Quarry in TLOU"
  createdAt: { type: Date, default: Date.now, index: true },
})

module.exports = mongoose.model('ActivityLog', activityLogSchema)
