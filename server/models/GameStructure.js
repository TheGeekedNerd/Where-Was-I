const mongoose = require('mongoose')

const missionSchema = new mongoose.Schema({
  id:    { type: String, required: true },
  title: { type: String, required: true },
  order: { type: Number, required: true },
}, { _id: false })

const actSchema = new mongoose.Schema({
  id:       { type: String, required: true },
  title:    { type: String, required: true },
  order:    { type: Number, required: true },
  missions: [missionSchema],
}, { _id: false })

const gameStructureSchema = new mongoose.Schema({
  rawgId:      { type: Number, required: true, unique: true },
  title:       { type: String, required: true },
  source:      { type: String, default: 'ign' },
  sourceUrl:   { type: String, required: true },
  lastScraped: { type: Date,   default: Date.now },
  acts:        [actSchema],
})

module.exports = mongoose.model('GameStructure', gameStructureSchema)
