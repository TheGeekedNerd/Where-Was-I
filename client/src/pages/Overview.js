import React, { useState, useEffect, useCallback } from 'react'
import './Overview.css'
import {
  IconDeviceGamepad2, IconTrophy, IconBook2,
  IconShieldCheck, IconShieldOff, IconPlus,
  IconChevronDown, IconLock, IconPlayerPlay,
  IconCircleCheck, IconClock, IconSword,
  IconAlertCircle, IconLoader2,
} from '@tabler/icons-react'

const ce = React.createElement

// ── API helper ────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function authFetch(path, opts = {}) {
  const token = localStorage.getItem('token')
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  token ? `Bearer ${token}` : '',
      ...(opts.headers || {}),
    },
  })
}

// ── Event type → icon + colour ────────────────────────────────────────────────
const EVENT_META = {
  mission_completed: { Icon: IconCircleCheck, color: '#00ff89' },
  game_started:      { Icon: IconPlayerPlay,  color: '#00ff89' },
  game_resumed:      { Icon: IconPlayerPlay,  color: '#00ff89' },
  game_paused:       { Icon: IconClock,       color: '#ffd93d' },
  game_completed:    { Icon: IconTrophy,      color: '#a5a5ff' },
}

const UP_NEXT_META = {
  locked:      { Icon: IconLock,        color: '#00ff89', label: 'Next chapter locked'  },
  paused:      { Icon: IconClock,       color: '#ffd93d', label: 'Ready to resume'      },
  ready:       { Icon: IconPlayerPlay,  color: '#00ff89', label: 'Ready to play'        },
  unavailable: { Icon: IconSword,       color: '#555',    label: 'No structure yet'     },
}

const LIBRARY_FILTERS = ['All', 'Playing', 'Paused', 'Completed']

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }) {
  return ce('div', { className: 'ov-stat-card' },
    ce('div', { className: 'ov-stat-icon' }, ce(Icon, { size: 16, stroke: 1.5 })),
    ce('div', { className: 'ov-stat-label' }, label),
    ce('div', { className: 'ov-stat-value' }, value),
    ce('div', { className: 'ov-stat-sub'   }, sub),
  )
}

// ── Game card ─────────────────────────────────────────────────────────────────
function GameCard({ game, onShieldToggle, onNavigate }) {
  if (game.add) {
    return ce('div', {
      className: 'ov-game-card ov-game-card--add',
      onClick:   game.onClick,
    },
      ce(IconPlus, { size: 22, stroke: 1.5 }),
      ce('span', null, 'Add a game'),
    )
  }

  const {
    rawgId, title, cover, typeLabel, status,
    progressPct, checkpointLabel, spoilerShield,
    totalMissions, completedCount,
  } = game

  const isPlaying  = status === 'playing'
  const fillColor  = isPlaying ? '#00ff89' : status === 'paused' ? '#ffd93d' : '#a5a5ff'
  const statusDisp = status.charAt(0).toUpperCase() + status.slice(1)

  function handleShieldClick(e) {
    e.stopPropagation()
    onShieldToggle(rawgId, !spoilerShield)
  }

  return ce('div', { className: 'ov-game-card', onClick: () => onNavigate(rawgId) },

    // Cover thumbnail + info + badge
    ce('div', { className: 'ov-game-card__header' },
      ce('div', { className: 'ov-game-card__thumb' },
        cover
          ? ce('img', { src: cover, alt: title, className: 'ov-game-card__cover' })
          : ce('div', { className: 'ov-game-card__cover-placeholder' },
              ce(IconSword, { size: 16, stroke: 1.5 })
            ),
      ),
      ce('div', { className: 'ov-game-card__info' },
        ce('div', { className: 'ov-game-card__title' }, title),
        ce('div', { className: 'ov-game-card__type'  }, typeLabel),
      ),
      ce('span', { className: `ov-badge ov-badge--${status}` }, statusDisp),
    ),

    // Checkpoint
    checkpointLabel
      ? ce('div', { className: 'ov-game-card__checkpoint' }, checkpointLabel)
      : totalMissions === 0
        ? ce('div', { className: 'ov-game-card__checkpoint ov-game-card__checkpoint--dim' },
            'No story structure yet')
        : null,

    // Progress bar
    ce('div', { className: 'ov-progress-row' },
      ce('div', { className: 'ov-progress-bar' },
        ce('div', {
          className: 'ov-progress-fill',
          style: { width: `${progressPct}%`, background: fillColor },
        })
      ),
      ce('span', { className: 'ov-progress-pct', style: { color: fillColor } },
        `${progressPct}%`),
    ),

    // Footer: missions label + shield toggle
    ce('div', { className: 'ov-game-card__footer' },
      totalMissions > 0
        ? ce('span', { className: 'ov-mission-count' },
            `${completedCount} / ${totalMissions} missions`)
        : ce('span', { className: 'ov-mission-count ov-mission-count--dim' }, '—'),

      ce('button', {
        className: `ov-shield ${spoilerShield ? 'ov-shield--on' : 'ov-shield--off'}`,
        onClick:   handleShieldClick,
        title:     spoilerShield ? 'Spoiler shield on — click to disable' : 'Spoiler shield off — click to enable',
      },
        spoilerShield
          ? ce(React.Fragment, null, ce(IconShieldCheck, { size: 13, stroke: 1.5 }), ' Shield on')
          : ce(React.Fragment, null, ce(IconShieldOff,   { size: 13, stroke: 1.5 }), ' Shield off')
      ),
    ),
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return ce('div', { className: `ov-skeleton ${className || ''}` })
}

function StatsSkeleton() {
  return ce('div', { className: 'ov-stats-row' },
    ...[0,1,2].map(i =>
      ce('div', { key: i, className: 'ov-stat-card' },
        ce(Skeleton, { className: 'ov-skel-icon' }),
        ce(Skeleton, { className: 'ov-skel-label' }),
        ce(Skeleton, { className: 'ov-skel-value' }),
        ce(Skeleton, { className: 'ov-skel-sub'   }),
      )
    )
  )
}

function GamesSkeleton() {
  return ce('div', { className: 'ov-game-grid' },
    ...[0,1,2].map(i =>
      ce('div', { key: i, className: 'ov-game-card' },
        ce('div', { className: 'ov-game-card__header' },
          ce(Skeleton, { className: 'ov-skel-thumb' }),
          ce('div', { className: 'ov-game-card__info' },
            ce(Skeleton, { className: 'ov-skel-title' }),
            ce(Skeleton, { className: 'ov-skel-type'  }),
          ),
        ),
        ce(Skeleton, { className: 'ov-skel-checkpoint' }),
        ce(Skeleton, { className: 'ov-skel-bar'        }),
      )
    )
  )
}

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return ce('div', { className: 'ov-error' },
    ce(IconAlertCircle, { size: 16, stroke: 1.5 }),
    ce('span', null, message),
    onRetry && ce('button', { className: 'ov-error__retry', onClick: onRetry }, 'Retry'),
  )
}

// ── Main Overview ─────────────────────────────────────────────────────────────
export default function Overview({ onNavigate }) {
  const [data,            setData]            = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)
  const [libFilter,       setLibFilter]       = useState('All')
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [shieldPending,   setShieldPending]   = useState({})   // rawgId → true while toggling

  // ── Fetch overview data ───────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/overview')
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  // ── Shield toggle ─────────────────────────────────────────────────────────
  async function handleShieldToggle(rawgId, newValue) {
    setShieldPending(p => ({ ...p, [rawgId]: true }))
    try {
      // Optimistic update
      setData(prev => ({
        ...prev,
        games: prev.games.map(g =>
          g.rawgId === rawgId ? { ...g, spoilerShield: newValue } : g
        ),
        upNext: prev.upNext.map(u =>
          u.rawgId === rawgId
            ? { ...u, tag: newValue ? 'locked' : 'ready' }
            : u
        ),
      }))

      const res = await authFetch(`/library/${rawgId}/shield`, {
        method: 'PATCH',
        body:   JSON.stringify({ spoilerShield: newValue }),
      })
      if (!res.ok) throw new Error('Shield update failed')
    } catch {
      // Rollback on failure
      fetchOverview()
    } finally {
      setShieldPending(p => { const n = { ...p }; delete n[rawgId]; return n })
    }
  }

  // ── Navigate to game detail ───────────────────────────────────────────────
  function handleNavigate(rawgId) {
    if (onNavigate) onNavigate(rawgId)
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const games = data?.games || []
  const filteredGames = libFilter === 'All'
    ? games
    : games.filter(g => g.status === libFilter.toLowerCase())

  const activity = data?.activity || []
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 3)

  const upNext = data?.upNext || []

  // ── Stats config ──────────────────────────────────────────────────────────
  const stats = data ? [
    { icon: IconDeviceGamepad2, label: 'Active games',    value: data.stats.active.value,         sub: data.stats.active.sub         },
    { icon: IconTrophy,         label: 'Completed',       value: data.stats.completed.value,      sub: data.stats.completed.sub      },
    { icon: IconBook2,          label: 'Stories tracked', value: data.stats.storiesTracked.value, sub: data.stats.storiesTracked.sub },
  ] : []

  // ── Render ────────────────────────────────────────────────────────────────
  return ce('div', { className: 'overview' },

    // ── Error ───────────────────────────────────────────────────────────────
    error && ce(ErrorBanner, { message: error, onRetry: fetchOverview }),

    // ── Stats row ───────────────────────────────────────────────────────────
    loading
      ? ce(StatsSkeleton)
      : ce('div', { className: 'ov-stats-row' },
          ...stats.map(s => ce(StatCard, { key: s.label, ...s }))
        ),

    // ── Game library ────────────────────────────────────────────────────────
    ce('section', { className: 'ov-section' },
      ce('div', { className: 'ov-section-header' },
        ce('h2', { className: 'ov-section-title' }, 'Game library'),
        !loading && ce('div', { className: 'ov-filter-pills' },
          ...LIBRARY_FILTERS.map(f =>
            ce('button', {
              key:       f,
              className: `ov-pill ${libFilter === f ? 'ov-pill--active' : ''}`,
              onClick:   () => setLibFilter(f),
            }, f)
          )
        ),
      ),

      loading
        ? ce(GamesSkeleton)
        : filteredGames.length === 0 && libFilter !== 'All'
          ? ce('div', { className: 'ov-empty' },
              `No ${libFilter.toLowerCase()} games yet.`)
          : ce('div', { className: 'ov-game-grid' },
              ...filteredGames.map(g =>
                ce(GameCard, {
                  key:           g.rawgId,
                  game:          { ...g, spoilerShield: shieldPending[g.rawgId] !== undefined ? g.spoilerShield : g.spoilerShield },
                  onShieldToggle: handleShieldToggle,
                  onNavigate:    handleNavigate,
                })
              ),
              libFilter === 'All' && ce(GameCard, {
                key:  'add',
                game: {
                  add:     true,
                  onClick: () => handleNavigate('discover'),
                },
              }),
            ),
    ),

    // ── Bottom grid ─────────────────────────────────────────────────────────
    ce('div', { className: 'ov-bottom-grid' },

      // Recent activity
      ce('section', { className: 'ov-section' },
        ce('h2', { className: 'ov-section-title' }, 'Recent activity'),

        loading
          ? ce('div', { className: 'ov-activity-list' },
              ...[0,1,2].map(i =>
                ce('div', { key: i, className: 'ov-activity-item' },
                  ce(Skeleton, { className: 'ov-skel-dot'      }),
                  ce('div', { style: { flex: 1 } },
                    ce(Skeleton, { className: 'ov-skel-act-text' }),
                    ce(Skeleton, { className: 'ov-skel-act-time' }),
                  ),
                )
              )
            )
          : activity.length === 0
            ? ce('div', { className: 'ov-activity-list ov-empty-panel' },
                ce('span', null, 'No activity yet — start playing a game!'))
            : ce('div', { className: 'ov-activity-list' },
                ...visibleActivity.map(a => {
                  const meta = EVENT_META[a.eventType] || EVENT_META['game_started']
                  return ce('div', { key: String(a.id), className: 'ov-activity-item' },
                    ce('span', { className: 'ov-activity-dot', style: { color: meta.color } },
                      ce(meta.Icon, { size: 14, stroke: 2 })
                    ),
                    ce('div', null,
                      ce('div', { className: 'ov-activity-text' }, a.label),
                      ce('div', { className: 'ov-activity-time' }, a.time),
                    ),
                  )
                })
              ),

        !loading && activity.length > 3 && ce('button', {
          className: 'ov-show-more',
          onClick:   () => setShowAllActivity(v => !v),
        },
          ce(IconChevronDown, {
            size:  16,
            stroke: 2,
            style: { transform: showAllActivity ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' },
          })
        ),
      ),

      // Up next
      ce('section', { className: 'ov-section' },
        ce('h2', { className: 'ov-section-title' }, 'Up next'),

        loading
          ? ce('div', { className: 'ov-upnext-list' },
              ...[0,1].map(i =>
                ce('div', { key: i, className: 'ov-upnext-item' },
                  ce(Skeleton, { className: 'ov-skel-un-title' }),
                  ce(Skeleton, { className: 'ov-skel-un-sub'   }),
                  ce(Skeleton, { className: 'ov-skel-un-tag'   }),
                )
              )
            )
          : upNext.length === 0
            ? ce('div', { className: 'ov-upnext-list ov-empty-panel' },
                ce('span', null, 'Nothing active — add a game to get started.'))
            : ce('div', { className: 'ov-upnext-list' },
                ...upNext.map(u => {
                  const meta = UP_NEXT_META[u.tag] || UP_NEXT_META['ready']
                  return ce('div', {
                    key:       u.rawgId,
                    className: 'ov-upnext-item',
                    onClick:   () => handleNavigate(u.rawgId),
                  },
                    ce('div', { className: 'ov-upnext-title' }, u.title),
                    ce('div', { className: 'ov-upnext-sub'   }, u.sub),
                    ce('span', { className: 'ov-upnext-tag', style: { color: meta.color } },
                      ce(meta.Icon, { size: 12, stroke: 2 }),
                      ' ' + meta.label,
                    ),
                  )
                })
              ),
      ),
    ),
  )
}