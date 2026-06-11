const mongoose = require('mongoose')

const userGameProgressSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rawgId:             { type: Number, required: true },
  completedMissions:  { type: [String], default: [] },  // array of mission ids
  currentMissionId:   { type: String,  default: null },
  updatedAt:          { type: Date,    default: Date.now },
})

userGameProgressSchema.index({ userId: 1, rawgId: 1 }, { unique: true })

// Always update updatedAt on save
userGameProgressSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model('UserGameProgress', userGameProgressSchema)
