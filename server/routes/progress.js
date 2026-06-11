/**
 * routes/progress.js
 *
 * Handles story progress tracking with spoiler-gating.
 *
 * Routes:
 *   GET    /progress/:rawgId            → get user's progress for a game
 *   GET    /structure/:rawgId           → get gated chapter/mission tree
 *   POST   /progress/:rawgId/complete   → mark a mission as done
 *   DELETE /progress/:rawgId/reset      → reset all progress for a game
 */

const express         = require('express')
const router          = express.Router()
const GameStructure   = require('../models/GameStructure')
const UserGameProgress = require('../models/UserGameProgress')

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given a flat list of all mission ids (in order) and the set of completed
 * mission ids, returns the id of the next mission the user should be on.
 *
 * Rules:
 *  - If nothing is completed yet, the first mission is current
 *  - If all missions are done, currentMissionId is null (game fully complete)
 *  - Otherwise it's the first mission not yet in completedMissions
 */
function resolveCurrent(allMissionIds, completedSet) {
  if (allMissionIds.length === 0) return null
  const next = allMissionIds.find(id => !completedSet.has(id))
  return next || null
}

/**
 * Builds the gated structure returned to the client.
 *
 * Visibility rules:
 *  - Completed missions         → fully visible, marked completed: true
 *  - Current mission            → fully visible, marked current: true
 *  - Everything after current   → title and id replaced with null, locked: true
 *  - Acts where all missions are locked → act title is also hidden
 */
function buildGatedStructure(acts, completedSet, currentMissionId) {
  let reachedCurrent = false
  let pastCurrent    = false

  return acts.map(act => {
    const gatedMissions = act.missions.map(mission => {
      if (pastCurrent) {
        // Everything after the current mission is locked
        return { id: null, title: null, order: mission.order, locked: true }
      }

      if (mission.id === currentMissionId) {
        reachedCurrent = true
        pastCurrent    = false  // current is visible; lock starts AFTER this
        return { ...mission, current: true, locked: false }
      }

      if (completedSet.has(mission.id)) {
        return { ...mission, completed: true, locked: false }
      }

      // This handles the edge case where currentMissionId is null (all done)
      // and we fall through — nothing should be locked in that case
      return { ...mission, locked: false }
    })

    // After processing each mission, set pastCurrent for the next iteration
    // We need to do this outside the map since map doesn't share state cleanly
    // Re-derive: pastCurrent should be true after we've seen currentMissionId
    const currentIndex = act.missions.findIndex(m => m.id === currentMissionId)
    if (currentIndex !== -1) {
      // current mission is in this act — everything after it in this act is locked
      // and all subsequent acts are locked
      pastCurrent = true
    }

    // Determine if the entire act is locked (all its missions are locked)
    const allLocked = gatedMissions.every(m => m.locked)

    return {
      id:       allLocked ? null  : act.id,
      title:    allLocked ? null  : act.title,
      order:    act.order,
      locked:   allLocked,
      missions: gatedMissions,
    }
  })
}

// ── GET /structure/:rawgId ────────────────────────────────────────────────────
// Returns the spoiler-gated chapter/mission tree for a game.
// Future missions are returned as { locked: true, title: null }.

router.get('/structure/:rawgId', async (req, res) => {
  const rawgId = Number(req.params.rawgId)

  try {
    const structure = await GameStructure.findOne({ rawgId })
    if (!structure) {
      return res.status(404).json({ message: 'No story structure available for this game' })
    }

    // Get user's progress (may not exist yet — treat as fresh start)
    const progress = await UserGameProgress.findOne({ userId: req.userId, rawgId })

    const completedSet    = new Set(progress?.completedMissions || [])
    const allMissionIds   = structure.acts.flatMap(a => a.missions.map(m => m.id))
    const currentMissionId = progress?.currentMissionId || resolveCurrent(allMissionIds, completedSet)

    const gatedActs = buildGatedStructure(structure.acts, completedSet, currentMissionId)

    res.json({
      rawgId,
      title:             structure.title,
      currentMissionId,
      totalMissions:     allMissionIds.length,
      completedCount:    completedSet.size,
      acts:              gatedActs,
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ── GET /progress/:rawgId ─────────────────────────────────────────────────────
// Returns raw progress data for a game (completed mission ids, current mission).

router.get('/:rawgId', async (req, res) => {
  const rawgId = Number(req.params.rawgId)

  try {
    const progress = await UserGameProgress.findOne({ userId: req.userId, rawgId })

    if (!progress) {
      return res.json({
        rawgId,
        completedMissions: [],
        currentMissionId:  null,
        started:           false,
      })
    }

    res.json({
      rawgId,
      completedMissions: progress.completedMissions,
      currentMissionId:  progress.currentMissionId,
      started:           true,
      updatedAt:         progress.updatedAt,
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ── POST /progress/:rawgId/complete ──────────────────────────────────────────
// Marks a mission as completed and advances currentMissionId to the next one.
// Body: { missionId: String }

router.post('/:rawgId/complete', async (req, res) => {
  const rawgId    = Number(req.params.rawgId)
  const { missionId } = req.body

  if (!missionId) {
    return res.status(400).json({ message: 'missionId is required' })
  }

  try {
    const structure = await GameStructure.findOne({ rawgId })
    if (!structure) {
      return res.status(404).json({ message: 'No story structure available for this game' })
    }

    const allMissionIds = structure.acts.flatMap(a => a.missions.map(m => m.id))

    // Validate the missionId exists in this game's structure
    if (!allMissionIds.includes(missionId)) {
      return res.status(400).json({ message: 'Invalid missionId for this game' })
    }

    // Upsert progress — add missionId to completedMissions if not already there
    let progress = await UserGameProgress.findOne({ userId: req.userId, rawgId })

    if (!progress) {
      progress = new UserGameProgress({
        userId:            req.userId,
        rawgId,
        completedMissions: [],
        currentMissionId:  null,
      })
    }

    const completedSet = new Set(progress.completedMissions)

    if (!completedSet.has(missionId)) {
      completedSet.add(missionId)
      progress.completedMissions = Array.from(completedSet)
    }

    // Advance to next mission
    progress.currentMissionId = resolveCurrent(allMissionIds, completedSet)
    await progress.save()

    res.json({
      completedMissions: progress.completedMissions,
      currentMissionId:  progress.currentMissionId,
      completedCount:    completedSet.size,
      totalMissions:     allMissionIds.length,
      finished:          progress.currentMissionId === null,
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ── DELETE /progress/:rawgId/reset ───────────────────────────────────────────
// Wipes all progress for a game — back to mission 1.

router.delete('/:rawgId/reset', async (req, res) => {
  const rawgId = Number(req.params.rawgId)

  try {
    await UserGameProgress.findOneAndDelete({ userId: req.userId, rawgId })
    res.json({ message: 'Progress reset', rawgId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
