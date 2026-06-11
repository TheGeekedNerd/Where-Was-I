import React, { useState, useEffect } from 'react'
import './Completed.css'
import {
  IconTrophy,
  IconLoader2,
  IconTrash,
  IconRepeat,
  IconStar,
  IconClock,
  IconDeviceGamepad2,
  IconChevronDown,
} from '@tabler/icons-react'

const ce = React.createElement
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
}

const STATUS_LABELS  = { playing: 'Playing', completed: 'Completed', dropped: 'Dropped' }
const STATUS_OPTIONS = ['playing', 'completed', 'dropped']

export default function Completed() {
  const [games, setGames]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [removing, setRemoving] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)

  useEffect(() => {
    async function fetchCompleted() {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/library`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        })
        const data = await res.json()
        if (res.ok) setGames(data.filter(g => g.status === 'completed'))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchCompleted()
  }, [])

  useEffect(() => {
    function handler(e) {
      if (!e.target.closest('.cp-status-menu')) setOpenMenu(null)
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  async function removeGame(rawgId) {
    setRemoving(rawgId)
    try {
      const res = await fetch(`${API_URL}/library/${rawgId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      if (res.ok) setGames(prev => prev.filter(g => g.rawgId !== rawgId))
    } catch (err) {
      console.error(err)
    } finally {
      setRemoving(null)
    }
  }

  async function changeStatus(rawgId, status) {
    setOpenMenu(null)
    setUpdating(rawgId)
    try {
      const res  = await fetch(`${API_URL}/library/${rawgId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ status })
      })
      const data = await res.json()
      if (res.ok) {
        // If moved out of completed, remove from this view
        if (status !== 'completed') {
          setGames(prev => prev.filter(g => g.rawgId !== rawgId))
        } else {
          setGames(prev => prev.map(g =>
            g.rawgId === rawgId ? { ...g, status: data.status, playthroughs: data.playthroughs } : g
          ))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdating(null)
    }
  }

  const totalPlaythroughs = games.reduce((sum, g) => sum + (g.playthroughs || 0), 0)

  if (loading) return ce('div', { className: 'cp-loading' },
    ce(IconLoader2, { size: 28, stroke: 1.5, className: 'cp-spin' })
  )

  return ce('div', { className: 'cp-wrapper' },

    ce('div', { className: 'cp-header' },
      ce('div', null,
        ce('h1', { className: 'cp-title' }, 'Completed'),
        ce('p',  { className: 'cp-sub' },
          `${games.length} game${games.length !== 1 ? 's' : ''} finished`,
          totalPlaythroughs > 0 && ` · ${totalPlaythroughs} total playthrough${totalPlaythroughs !== 1 ? 's' : ''}`
        )
      )
    ),

    games.length === 0 && ce('div', { className: 'cp-empty' },
      ce(IconTrophy, { size: 44, stroke: 1 }),
      ce('p',    null, 'No completed games yet'),
      ce('span', null, 'Mark a game as Completed in My Games to see it here')
    ),

    games.length > 0 && ce('div', { className: 'cp-grid' },
      ...games.map(game =>
        ce('div', { key: game.rawgId, className: 'cp-card' },

          ce('div', {
            className: 'cp-card-cover',
            style: { backgroundImage: game.cover ? `url(${game.cover})` : 'none' }
          },
            !game.cover && ce('div', { className: 'cp-card-no-cover' },
              ce(IconDeviceGamepad2, { size: 36, stroke: 1 })
            ),
            ce('div', { className: 'cp-card-cover-overlay' }),

            // Playthroughs badge — always visible, top-left of cover
            ce('div', { className: 'cp-cover-badge' },
              ce(IconRepeat, { size: 11, stroke: 2 }),
              ` ${game.playthroughs || 0}x`
            ),

            ce('button', {
              className: 'cp-card-remove',
              onClick:   (e) => { e.stopPropagation(); removeGame(game.rawgId) },
              disabled:  removing === game.rawgId,
              title:     'Remove from library'
            },
              removing === game.rawgId
                ? ce(IconLoader2, { size: 13, stroke: 2, className: 'cp-spin' })
                : ce(IconTrash,   { size: 13, stroke: 2 })
            )
          ),

          ce('div', { className: 'cp-card-body' },
            ce('p', { className: 'cp-card-genre' },
              game.genres && game.genres.length > 0 ? game.genres.join(' · ') : 'Game'
            ),
            ce('h3', { className: 'cp-card-title' }, game.title),

            ce('div', { className: 'cp-card-meta' },
              game.rating   && ce('span', null, ce(IconStar,  { size: 12, stroke: 1.5 }), ' ', game.rating),
              game.playtime && ce('span', null, ce(IconClock, { size: 12, stroke: 1.5 }), ' ', game.playtime),
              game.released && ce('span', null, game.released)
            ),

            // Playthroughs — always visible in card body too
            ce('div', { className: 'cp-playthroughs' },
              ce(IconRepeat, { size: 12, stroke: 1.5 }),
              ` ${game.playthroughs || 0} playthrough${(game.playthroughs || 0) !== 1 ? 's' : ''}`
            ),

            ce('div', { className: 'cp-status-menu' },
              ce('button', {
                className: 'cp-status-btn',
                onClick:   (e) => { e.stopPropagation(); setOpenMenu(openMenu === game.rawgId ? null : game.rawgId) },
                disabled:  updating === game.rawgId
              },
                updating === game.rawgId
                  ? ce(IconLoader2, { size: 12, stroke: 2, className: 'cp-spin' })
                  : STATUS_LABELS[game.status],
                !updating && ce(IconChevronDown, { size: 12, stroke: 2 })
              ),
              openMenu === game.rawgId && ce('div', { className: 'cp-status-dropdown' },
                ...STATUS_OPTIONS.filter(s => s !== game.status).map(s =>
                  ce('button', {
                    key:       s,
                    className: 'cp-status-option',
                    onClick:   (e) => { e.stopPropagation(); changeStatus(game.rawgId, s) }
                  }, STATUS_LABELS[s])
                )
              )
            )
          )
        )
      )
    )
  )
}