const express = require('express')
const router  = express.Router()
const Game    = require('../models/Game')

// GET /library — fetch all games for the logged-in user
router.get('/', async (req, res) => {
  try {
    const games = await Game.find({ userId: req.userId }).sort({ addedAt: -1 })
    res.json(games)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /library — add a game
router.post('/', async (req, res) => {
  const { rawgId, title, cover, rating, released, genres, platforms, playtime, slug } = req.body
  if (!rawgId || !title) return res.status(400).json({ message: 'rawgId and title are required' })
  try {
    const game = await Game.create({
      userId: req.userId,
      rawgId, title, cover, rating, released, genres, platforms, playtime, slug
    })
    res.status(201).json(game)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Game already in library' })
    res.status(500).json({ message: 'Server error' })
  }
})

// DELETE /library/:rawgId — remove a game
router.delete('/:rawgId', async (req, res) => {
  try {
    const result = await Game.findOneAndDelete({ userId: req.userId, rawgId: Number(req.params.rawgId) })
    if (!result) return res.status(404).json({ message: 'Game not found in library' })
    res.json({ message: 'Game removed' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /library/:rawgId/status — update play status
router.patch('/:rawgId/status', async (req, res) => {
  const { status } = req.body
  if (!['playing', 'completed', 'dropped'].includes(status))
    return res.status(400).json({ message: 'Invalid status' })
  try {
    const game = await Game.findOneAndUpdate(
      { userId: req.userId, rawgId: Number(req.params.rawgId) },
      { status },
      { new: true }
    )
    if (!game) return res.status(404).json({ message: 'Game not found in library' })
    res.json(game)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router