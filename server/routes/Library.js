const express      = require('express')
const router       = express.Router()
const Game         = require('../models/Game')
const ActivityLog  = require('../models/ActivityLog')

// ── GET /library ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const games = await Game.find({ userId: req.userId }).sort({ addedAt: -1 })
    res.json(games)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// ── POST /library ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { rawgId, title, cover, rating, released, genres, platforms, playtime, slug } = req.body
  if (!rawgId || !title) return res.status(400).json({ message: 'rawgId and title are required' })
  try {
    const game = await Game.create({
      userId: req.userId,
      rawgId, title, cover, rating, released, genres, platforms, playtime, slug,
      spoilerShield: true,
    })

    // Log game_started
    await ActivityLog.create({
      userId:    req.userId,
      rawgId,
      gameTitle: title,
      cover:     cover || null,
      eventType: 'game_started',
      label:     `Started ${title}`,
    })

    res.status(201).json(game)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Game already in library' })
    res.status(500).json({ message: 'Server error' })
  }
})

// ── DELETE /library/:rawgId ───────────────────────────────────────────────────
router.delete('/:rawgId', async (req, res) => {
  try {
    const result = await Game.findOneAndDelete({
      userId: req.userId,
      rawgId: Number(req.params.rawgId),
    })
    if (!result) return res.status(404).json({ message: 'Game not found in library' })
    res.json({ message: 'Game removed' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// ── PATCH /library/:rawgId/status ────────────────────────────────────────────
router.patch('/:rawgId/status', async (req, res) => {
  const { status } = req.body
  if (!['playing', 'paused', 'completed', 'dropped'].includes(status))
    return res.status(400).json({ message: 'Invalid status' })

  try {
    const game = await Game.findOne({ userId: req.userId, rawgId: Number(req.params.rawgId) })
    if (!game) return res.status(404).json({ message: 'Game not found in library' })

    const prevStatus  = game.status
    const nowCompleted = status === 'completed'
    const wasCompleted = prevStatus === 'completed'

    const update = { status }
    if (nowCompleted && !wasCompleted) update.$inc = { playthroughs: 1 }

    const updated = await Game.findOneAndUpdate(
      { userId: req.userId, rawgId: Number(req.params.rawgId) },
      update,
      { new: true }
    )

    // ── Activity log ────────────────────────────────────────────────────────
    let eventType, label
    if (status === 'completed') {
      eventType = 'game_completed'
      label     = `Marked ${game.title} as completed`
    } else if (status === 'paused') {
      eventType = 'game_paused'
      label     = `Paused ${game.title}`
    } else if (status === 'playing' && prevStatus === 'paused') {
      eventType = 'game_resumed'
      label     = `Resumed ${game.title}`
    } else if (status === 'playing' && prevStatus !== 'playing') {
      eventType = 'game_started'
      label     = `Started ${game.title}`
    }

    if (eventType) {
      await ActivityLog.create({
        userId:    req.userId,
        rawgId:    game.rawgId,
        gameTitle: game.title,
        cover:     game.cover || null,
        eventType,
        label,
      })
    }

    res.json(updated)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// ── PATCH /library/:rawgId/shield ────────────────────────────────────────────
router.patch('/:rawgId/shield', async (req, res) => {
  const { spoilerShield } = req.body
  if (typeof spoilerShield !== 'boolean')
    return res.status(400).json({ message: 'spoilerShield must be a boolean' })

  try {
    const updated = await Game.findOneAndUpdate(
      { userId: req.userId, rawgId: Number(req.params.rawgId) },
      { spoilerShield },
      { new: true }
    )
    if (!updated) return res.status(404).json({ message: 'Game not found in library' })
    res.json(updated)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router