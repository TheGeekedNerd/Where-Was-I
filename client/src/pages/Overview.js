import React, { useState } from 'react'
import './Overview.css'
import {IconDeviceGamepad2, IconTrophy, IconBook2, IconShieldCheck, IconShieldOff, IconPlus, IconStar, IconHeart, IconSword, IconChevronDown, IconLock, IconPlayerPlay, IconCircleCheck, IconClock,
} from '@tabler/icons-react'

const ce = React.createElement

// ── Static mock data ──────────────────────────────────────────
const STATS = [
  { icon: IconDeviceGamepad2, label: 'Active games',    value: 3,  sub: '2 playing · 1 paused' },
  { icon: IconTrophy,         label: 'Completed',       value: 9,  sub: 'All time' },
  { icon: IconBook2,          label: 'Stories tracked', value: 12, sub: 'Across all games' },
]

const GAMES = [
  {
    id: 1, title: 'The Last of Us',   type: 'Chapter-based · 9 chapters',
    status: 'Playing', progress: 56, checkpoint: 'Chapter 5 of 9',
    location: 'Pittsburgh',     shield: true,  icon: IconHeart, iconColor: '#ff6b6b',
  },
  {
    id: 2, title: 'God of War',       type: 'Chapter-based · 9 chapters',
    status: 'Playing', progress: 33, checkpoint: 'Chapter 3 of 9',
    location: 'The Lake of Nine', shield: true,  icon: IconSword, iconColor: '#00ff89',
  },
  {
    id: 3, title: 'Super Mario Odyssey', type: 'World-based · 17 kingdoms',
    status: 'Paused',  progress: 35, checkpoint: 'Kingdom 6 of 17',
    location: 'Sand Kingdom',   shield: false, icon: IconStar,  iconColor: '#ffd93d',
  },
]

const ACTIVITY = [
  { id: 1, text: 'Completed Chapter 4 in The Last of Us',      time: 'Today, 8:30 PM',      color: '#00ff89', Icon: IconCircleCheck },
  { id: 2, text: 'Started Chapter 3 in God of War',            time: 'Yesterday, 10:00 PM', color: '#00ff89', Icon: IconPlayerPlay  },
  { id: 3, text: 'Paused Super Mario Odyssey at Kingdom 6',    time: '3 days ago',           color: '#ffd93d', Icon: IconClock       },
  { id: 4, text: 'Marked Red Dead Redemption 2 as completed',  time: '1 week ago',           color: '#888',    Icon: IconTrophy      },
]

const UP_NEXT = [
  { id: 1, title: 'The Last of Us',  sub: 'Chapter 6 — spoiler hidden',  tag: 'Next chapter locked', TagIcon: IconLock,        tagColor: '#00ff89' },
  { id: 2, title: 'God of War',      sub: 'Chapter 4 — spoiler hidden',  tag: 'Next chapter locked', TagIcon: IconLock,        tagColor: '#00ff89' },
  { id: 3, title: 'Mario Odyssey',   sub: 'Kingdom 7 — paused',          tag: 'Ready to resume',     TagIcon: IconPlayerPlay,  tagColor: '#ffd93d' },
]

const LIBRARY_FILTERS = ['All', 'Playing', 'Paused', 'Completed']

// ── Sub-components ────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }) {
  return ce('div', { className: 'ov-stat-card' },
    ce('div', { className: 'ov-stat-icon' }, ce(Icon, { size: 16, stroke: 1.5 })),
    ce('div', { className: 'ov-stat-label' }, label),
    ce('div', { className: 'ov-stat-value' }, value),
    ce('div', { className: 'ov-stat-sub'   }, sub),
  )
}

function GameCard({ game, onAdd }) {
  if (game.add) {
    return ce('div', { className: 'ov-game-card ov-game-card--add', onClick: onAdd },
      ce(IconPlus, { size: 22, stroke: 1.5 }),
      ce('span', null, 'Add a game')
    )
  }

  const { icon: GameIcon, iconColor, title, type, status, progress, checkpoint, location, shield } = game
  const isPlaying = status === 'Playing'
  const fillColor  = isPlaying ? '#00ff89' : '#ffd93d'

  return ce('div', { className: 'ov-game-card' },
    ce('div', { className: 'ov-game-card__header' },
      ce('div', { className: 'ov-game-card__icon', style: { color: iconColor } },
        ce(GameIcon, { size: 18, stroke: 1.5 })
      ),
      ce('div', { className: 'ov-game-card__info' },
        ce('div', { className: 'ov-game-card__title' }, title),
        ce('div', { className: 'ov-game-card__type'  }, type),
      ),
      ce('span', { className: `ov-badge ov-badge--${status.toLowerCase()}` }, status),
    ),

    ce('div', { className: 'ov-game-card__checkpoint' }, checkpoint),

    ce('div', { className: 'ov-progress-row' },
      ce('div', { className: 'ov-progress-bar' },
        ce('div', { className: 'ov-progress-fill', style: { width: `${progress}%`, background: fillColor } })
      ),
      ce('span', { className: 'ov-progress-pct', style: { color: fillColor } }, `${progress}%`),
    ),

    ce('div', { className: 'ov-game-card__footer' },
      ce('span', { className: 'ov-location' }, ` ${location}`),
      ce('span', { className: `ov-shield ${shield ? 'ov-shield--on' : 'ov-shield--off'}` },
        shield
          ? ce(React.Fragment, null, ce(IconShieldCheck, { size: 13, stroke: 1.5 }), ' Shield on')
          : ce(React.Fragment, null, ce(IconShieldOff,   { size: 13, stroke: 1.5 }), ' Shield off')
      ),
    ),
  )
}

// ── Main Overview ─────────────────────────────────────────────
export default function Overview() {
  const [libFilter, setLibFilter]           = useState('All')
  const [showAllActivity, setShowAllActivity] = useState(false)

  const filteredGames    = libFilter === 'All' ? GAMES : GAMES.filter(g => g.status === libFilter)
  const visibleActivity  = showAllActivity ? ACTIVITY : ACTIVITY.slice(0, 2)

  return ce('div', { className: 'overview' },

    // Stats row
    ce('div', { className: 'ov-stats-row' },
      ...STATS.map(s => ce(StatCard, { key: s.label, ...s }))
    ),

    // Game library
    ce('section', { className: 'ov-section' },
      ce('div', { className: 'ov-section-header' },
        ce('h2', { className: 'ov-section-title' }, 'Game library'),
        ce('div', { className: 'ov-filter-pills' },
          ...LIBRARY_FILTERS.map(f =>
            ce('button', {
              key: f,
              className: `ov-pill ${libFilter === f ? 'ov-pill--active' : ''}`,
              onClick: () => setLibFilter(f)
            }, f)
          )
        ),
      ),
      ce('div', { className: 'ov-game-grid' },
        ...filteredGames.map(g => ce(GameCard, { key: g.id, game: g })),
        libFilter === 'All' && ce(GameCard, {
          key: 'add',
          game: { add: true },
          onAdd: () => alert('Add game — coming soon!')
        }),
      ),
    ),

    // Bottom grid
    ce('div', { className: 'ov-bottom-grid' },

      // Recent activity
      ce('section', { className: 'ov-section' },
        ce('h2', { className: 'ov-section-title' }, 'Recent activity'),
        ce('div', { className: 'ov-activity-list' },
          ...visibleActivity.map(a =>
            ce('div', { key: a.id, className: 'ov-activity-item' },
              ce('span', { className: 'ov-activity-dot', style: { color: a.color } },
                ce(a.Icon, { size: 14, stroke: 2 })
              ),
              ce('div', null,
                ce('div', { className: 'ov-activity-text' }, a.text),
                ce('div', { className: 'ov-activity-time' }, a.time),
              ),
            )
          )
        ),
        ACTIVITY.length > 2 && ce('button', {
          className: 'ov-show-more',
          onClick: () => setShowAllActivity(v => !v)
        },
          ce(IconChevronDown, {
            size: 16,
            stroke: 2,
            style: { transform: showAllActivity ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }
          })
        ),
      ),

      // Up next
      ce('section', { className: 'ov-section' },
        ce('h2', { className: 'ov-section-title' }, 'Up next'),
        ce('div', { className: 'ov-upnext-list' },
          ...UP_NEXT.map(u =>
            ce('div', { key: u.id, className: 'ov-upnext-item' },
              ce('div', { className: 'ov-upnext-title' }, u.title),
              ce('div', { className: 'ov-upnext-sub'   }, u.sub),
              ce('span', { className: 'ov-upnext-tag', style: { color: u.tagColor } },
                ce(u.TagIcon, { size: 12, stroke: 2 }),
                ' ' + u.tag
              ),
            )
          )
        ),
      ),
    ),
  )
}