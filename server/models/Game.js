const mongoose = require('mongoose')

const gameSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rawgId:        { type: Number, required: true },
  title:         { type: String, required: true },
  cover:         { type: String },
  rating:        { type: String },
  released:      { type: String },
  genres:        [{ type: String }],
  platforms:     [{ type: String }],
  playtime:      { type: String },
  slug:          { type: String },
  status:        { type: String, enum: ['playing', 'paused', 'completed', 'dropped'], default: 'playing' },
  spoilerShield: { type: Boolean, default: true },
  playthroughs:  { type: Number, default: 0 },
  addedAt:       { type: Date, default: Date.now },
})

gameSchema.index({ userId: 1, rawgId: 1 }, { unique: true })

module.exports = mongoose.model('Game', gameSchema)