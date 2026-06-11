import React, { useState, useEffect, useCallback } from 'react'
import './GameDetailModal.css'
import {
  IconX,
  IconLock,
  IconCheck,
  IconLoader2,
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
  IconRotate,
  IconDeviceGamepad2,
} from '@tabler/icons-react'

const ce = React.createElement
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ completed, total }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return ce('div', { className: 'gdm-progress-wrap' },
    ce('div', { className: 'gdm-progress-labels' },
      ce('span', null, `${completed} / ${total} missions`),
      ce('span', { className: 'gdm-progress-pct' }, `${pct}%`)
    ),
    ce('div', { className: 'gdm-progress-track' },
      ce('div', {
        className: 'gdm-progress-fill',
        style: { width: `${pct}%` }
      })
    )
  )
}

function MissionRow({ mission, isReadOnly, onComplete, completing }) {
  if (mission.locked) {
    return ce('div', { className: 'gdm-mission gdm-mission--locked' },
      ce('div', { className: 'gdm-mission-lock-icon' },
        ce(IconLock, { size: 11, stroke: 2 })
      ),
      ce('span', { className: 'gdm-mission-title gdm-mission-title--blurred' },
        mission.title || 'Locked mission'
      )
    )
  }

  if (mission.completed) {
    return ce('div', { className: 'gdm-mission gdm-mission--completed' },
      ce('div', { className: 'gdm-mission-check' },
        ce(IconCheck, { size: 11, stroke: 2.5 })
      ),
      ce('span', { className: 'gdm-mission-title' }, mission.title)
    )
  }

  if (mission.current) {
    return ce('div', { className: 'gdm-mission gdm-mission--current' },
      ce('div', { className: 'gdm-mission-dot' }),
      ce('span', { className: 'gdm-mission-title' }, mission.title),
      !isReadOnly && ce('button', {
        className:  'gdm-mission-btn',
        onClick:    () => onComplete(mission.id),
        disabled:   completing === mission.id,
        title:      'Mark as done'
      },
        completing === mission.id
          ? ce(IconLoader2, { size: 12, stroke: 2, className: 'gdm-spin' })
          : 'Done'
      )
    )
  }

  // Future unlocked missions (shouldn't normally render but safe fallback)
  return ce('div', { className: 'gdm-mission gdm-mission--upcoming' },
    ce('div', { className: 'gdm-mission-upcoming-dot' }),
    ce('span', { className: 'gdm-mission-title' }, mission.title)
  )
}

function ActSection({ act, isReadOnly, onComplete, completing }) {
  const [open, setOpen] = useState(!act.locked)

  const completedCount = act.missions.filter(m => m.completed).length
  const totalCount     = act.missions.length
  const hasCurrent     = act.missions.some(m => m.current)

  if (act.locked) {
    return ce('div', { className: 'gdm-act gdm-act--locked' },
      ce('div', { className: 'gdm-act-header gdm-act-header--locked' },
        ce(IconLock, { size: 13, stroke: 2, className: 'gdm-act-lock-icon' }),
        ce('span', { className: 'gdm-act-title gdm-act-title--blurred' },
          act.title || 'Locked chapter'
        )
      )
    )
  }

  return ce('div', { className: `gdm-act ${hasCurrent ? 'gdm-act--active' : ''}` },
    ce('button', {
      className: 'gdm-act-header',
      onClick:   () => setOpen(o => !o)
    },
      ce('div', { className: 'gdm-act-header-left' },
        open
          ? ce(IconChevronDown,  { size: 14, stroke: 2, className: 'gdm-act-chevron' })
          : ce(IconChevronRight, { size: 14, stroke: 2, className: 'gdm-act-chevron' }),
        ce('span', { className: 'gdm-act-title' }, act.title)
      ),
      ce('span', { className: 'gdm-act-count' },
        completedCount === totalCount
          ? ce(IconCheck, { size: 12, stroke: 2.5, className: 'gdm-act-done-icon' })
          : `${completedCount}/${totalCount}`
      )
    ),
    open && ce('div', { className: 'gdm-act-missions' },
      ...act.missions.map(mission =>
        ce(MissionRow, {
          key:       mission.id || mission.order,
          mission,
          isReadOnly,
          onComplete,
          completing,
        })
      )
    )
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function GameDetailModal({ game, isReadOnly, onClose }) {
  const [structure,   setStructure]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [completing,  setCompleting]  = useState(null)
  const [resetting,   setResetting]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const noStructure = error === 'no_structure'

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Fetch gated structure
  const fetchStructure = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`${API_URL}/structure/${game.rawgId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      const data = await res.json()
      if (res.status === 404) { setError('no_structure'); return }
      if (!res.ok) { setError('fetch_failed'); return }
      setStructure(data)
    } catch {
      setError('fetch_failed')
    } finally {
      setLoading(false)
    }
  }, [game.rawgId])

  useEffect(() => { fetchStructure() }, [fetchStructure])

  async function completeMission(missionId) {
    setCompleting(missionId)
    try {
      const res  = await fetch(`${API_URL}/progress/${game.rawgId}/complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ missionId })
      })
      const data = await res.json()
      if (res.ok) {
        // Re-fetch the gated structure so the next mission unlocks correctly
        await fetchStructure()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCompleting(null)
    }
  }

  async function resetProgress() {
    setResetting(true)
    try {
      const res = await fetch(`${API_URL}/progress/${game.rawgId}/reset`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      if (res.ok) {
        setShowConfirm(false)
        await fetchStructure()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setResetting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return ce('div', {
    className: 'gdm-backdrop',
    onClick:   (e) => { if (e.target === e.currentTarget) onClose() }
  },
    ce('div', { className: 'gdm-modal', role: 'dialog', 'aria-modal': 'true' },

      // Cover banner
      ce('div', {
        className: 'gdm-cover',
        style: { backgroundImage: game.cover ? `url(${game.cover})` : 'none' }
      },
        !game.cover && ce('div', { className: 'gdm-cover-fallback' },
          ce(IconDeviceGamepad2, { size: 40, stroke: 1 })
        ),
        ce('div', { className: 'gdm-cover-overlay' }),
        ce('div', { className: 'gdm-cover-meta' },
          game.genres?.length > 0 && ce('span', { className: 'gdm-cover-genre' },
            game.genres[0]
          ),
          ce('h2', { className: 'gdm-cover-title' }, game.title)
        ),
        ce('button', { className: 'gdm-close', onClick: onClose, 'aria-label': 'Close' },
          ce(IconX, { size: 16, stroke: 2 })
        )
      ),

      // Body
      ce('div', { className: 'gdm-body' },

        // ── No structure available ──
        noStructure && ce('div', { className: 'gdm-no-structure' },
          ce(IconDeviceGamepad2, { size: 36, stroke: 1 }),
          ce('p', null, 'Story tracker not available for this game yet'),
          ce('span', null, 'Check back later or add it to sources.json')
        ),

        // ── Loading ──
        !noStructure && loading && ce('div', { className: 'gdm-loading' },
          ce(IconLoader2, { size: 24, stroke: 1.5, className: 'gdm-spin' })
        ),

        // ── Fetch error ──
        !noStructure && !loading && error === 'fetch_failed' && ce('div', { className: 'gdm-error' },
          ce(IconAlertTriangle, { size: 24, stroke: 1.5 }),
          ce('p', null, 'Failed to load story structure'),
          ce('button', { className: 'gdm-retry-btn', onClick: fetchStructure }, 'Retry')
        ),

        // ── Structure loaded ──
        !noStructure && !loading && !error && structure && ce(React.Fragment, null,

          // Progress bar
          ce(ProgressBar, {
            completed: structure.completedCount,
            total:     structure.totalMissions,
          }),

          // Fully finished banner
          structure.completedCount === structure.totalMissions &&
          structure.totalMissions > 0 &&
          ce('div', { className: 'gdm-finished-banner' },
            '🎮 You finished this one. Respect.'
          ),

          // Reset button (not shown in read-only / fully locked)
          !isReadOnly && structure.completedCount > 0 && ce('div', { className: 'gdm-reset-row' },
            !showConfirm
              ? ce('button', {
                  className: 'gdm-reset-btn',
                  onClick:   () => setShowConfirm(true)
                },
                  ce(IconRotate, { size: 12, stroke: 2 }),
                  ' Reset progress'
                )
              : ce('div', { className: 'gdm-confirm-row' },
                  ce('span', null, 'Reset all progress?'),
                  ce('button', {
                    className: 'gdm-confirm-yes',
                    onClick:   resetProgress,
                    disabled:  resetting
                  },
                    resetting
                      ? ce(IconLoader2, { size: 12, stroke: 2, className: 'gdm-spin' })
                      : 'Yes, reset'
                  ),
                  ce('button', {
                    className: 'gdm-confirm-no',
                    onClick:   () => setShowConfirm(false)
                  }, 'Cancel')
                )
          ),

          // Acts + missions
          ce('div', { className: 'gdm-acts' },
            ...structure.acts.map((act, i) =>
              ce(ActSection, {
                key:       act.id || i,
                act,
                isReadOnly,
                onComplete: completeMission,
                completing,
              })
            )
          )
        )
      )
    )
  )
}
