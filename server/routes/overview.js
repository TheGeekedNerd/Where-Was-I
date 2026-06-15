/**
 * routes/overview.js
 *
 * GET /overview
 *
 * Returns everything the Overview page needs in one round-trip:
 *   stats       — active/completed counts + stories-tracked
 *   games       — full library with progress % and current checkpoint label
 *   activity    — recent ActivityLog entries (newest first, max 20)
 *   upNext      — current mission for every active (playing/paused) game
 */

const express          = require('express')
const router           = express.Router()
const Game             = require('../models/Game')
const GameStructure    = require('../models/GameStructure')
const UserGameProgress = require('../models/UserGameProgress')
const ActivityLog      = require('../models/ActivityLog')

// ── Relative-time formatter ───────────────────────────────────────────────────
// Returns strings like "Today, 8:30 PM" / "Yesterday, 10:00 PM" / "3 days ago"
function relativeTime(date) {
  const now    = new Date()
  const then   = new Date(date)
  const diffMs = now - then
  const diffD  = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const timeStr = then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (diffD === 0) return `Today, ${timeStr}`
  if (diffD === 1) return `Yesterday, ${timeStr}`
  if (diffD < 7)   return `${diffD} days ago`
  if (diffD < 14)  return '1 week ago'
  if (diffD < 30)  return `${Math.floor(diffD / 7)} weeks ago`
  if (diffD < 60)  return '1 month ago'
  return `${Math.floor(diffD / 30)} months ago`
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const userId = req.userId

    // ── 1. Fetch full library ─────────────────────────────────────────────────
    const allGames = await Game.find({ userId }).sort({ addedAt: -1 }).lean()

    const activeGames    = allGames.filter(g => g.status === 'playing' || g.status === 'paused')
    const completedGames = allGames.filter(g => g.status === 'completed')
    const playingGames   = allGames.filter(g => g.status === 'playing')
    const pausedGames    = allGames.filter(g => g.status === 'paused')

    // ── 2. Stats ──────────────────────────────────────────────────────────────
    const activeRawgIds      = activeGames.map(g => g.rawgId)
    const completedRawgIds   = completedGames.map(g => g.rawgId)
    const allRawgIds         = allGames.map(g => g.rawgId)

    const storiesTrackedCount = await GameStructure.countDocuments({ rawgId: { $in: allRawgIds } })

    const playingCount = playingGames.length
    const pausedCount  = pausedGames.length
    const subParts     = []
    if (playingCount) subParts.push(`${playingCount} playing`)
    if (pausedCount)  subParts.push(`${pausedCount} paused`)

    const stats = {
      active: {
        value: activeGames.length,
        sub:   subParts.length ? subParts.join(' · ') : 'None active',
      },
      completed: {
        value: completedGames.length,
        sub:   'All time',
      },
      storiesTracked: {
        value: storiesTrackedCount,
        sub:   'Across all games',
      },
    }

    // ── 3. Progress for every game in library ─────────────────────────────────
    const [progressDocs, structureDocs] = await Promise.all([
      UserGameProgress.find({ userId, rawgId: { $in: allRawgIds } }).lean(),
      GameStructure.find({ rawgId: { $in: allRawgIds } }, { rawgId: 1, acts: 1 }).lean(),
    ])

    const progressByRawgId   = Object.fromEntries(progressDocs.map(p => [p.rawgId, p]))
    const structureByRawgId  = Object.fromEntries(structureDocs.map(s => [s.rawgId, s]))

    // ── 4. Build enriched game cards ──────────────────────────────────────────
    const games = allGames.map(game => {
      const progress  = progressByRawgId[game.rawgId]
      const structure = structureByRawgId[game.rawgId]

      let progressPct    = 0
      let checkpointLabel = null
      let currentActTitle = null
      let currentMissionTitle = null
      let totalMissions   = 0
      let completedCount  = 0

      if (structure) {
        const allMissions   = structure.acts.flatMap(a => a.missions)
        totalMissions       = allMissions.length
        const completedSet  = new Set(progress?.completedMissions || [])
        completedCount      = completedSet.size
        progressPct         = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0

        // Find current mission for checkpoint label
        const currentId = progress?.currentMissionId
        if (currentId) {
          for (const act of structure.acts) {
            const mission = act.missions.find(m => m.id === currentId)
            if (mission) {
              currentActTitle     = act.title
              currentMissionTitle = mission.title
              // Spoiler-gate: if shield is on, only show the act name
              checkpointLabel = game.spoilerShield
                ? currentActTitle
                : `${currentActTitle} · ${currentMissionTitle}`
              break
            }
          }
        } else if (completedCount === totalMissions && totalMissions > 0) {
          checkpointLabel = 'All missions complete'
        }
      }

      // Genre/type label: use genres array if present
      const typeLabel = game.genres?.length
        ? game.genres.slice(0, 2).join(' · ')
        : 'Story-driven'

      return {
        rawgId:        game.rawgId,
        title:         game.title,
        cover:         game.cover || null,
        status:        game.status,
        spoilerShield: game.spoilerShield,
        genres:        game.genres || [],
        typeLabel,
        progressPct,
        totalMissions,
        completedCount,
        checkpointLabel,
        currentActTitle,
        currentMissionTitle: game.spoilerShield ? null : currentMissionTitle,
        hasStructure:  !!structure,
        addedAt:       game.addedAt,
      }
    })

    // ── 5. Recent activity ────────────────────────────────────────────────────
    const rawActivity = await ActivityLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    const activity = rawActivity.map(a => ({
      id:        a._id,
      eventType: a.eventType,
      gameTitle: a.gameTitle,
      cover:     a.cover || null,
      label:     a.label,
      rawgId:    a.rawgId,
      time:      relativeTime(a.createdAt),
      createdAt: a.createdAt,
    }))

    // ── 6. Up next — active games only ────────────────────────────────────────
    const upNext = games
      .filter(g => g.status === 'playing' || g.status === 'paused')
      .map(g => {
        let sub, tag
        if (!g.hasStructure) {
          sub = 'No story structure yet'
          tag = 'unavailable'
        } else if (g.status === 'paused') {
          sub = g.checkpointLabel ? `Paused at ${g.checkpointLabel}` : 'Paused'
          tag = 'paused'
        } else if (g.spoilerShield) {
          sub = g.checkpointLabel ? `${g.checkpointLabel} — spoiler hidden` : 'Shield active'
          tag = 'locked'
        } else {
          sub = g.checkpointLabel || 'In progress'
          tag = 'ready'
        }

        return {
          rawgId: g.rawgId,
          title:  g.title,
          cover:  g.cover || null,
          sub,
          tag,
        }
      })

    // ── Response ──────────────────────────────────────────────────────────────
    res.json({ stats, games, activity, upNext })

  } catch (err) {
    console.error('[overview] Error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router