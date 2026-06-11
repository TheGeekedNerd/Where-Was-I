import React, { useState, useEffect } from 'react'
import './MyGames.css'
import GameDetailModal from './GameDetailModal'
import {
  IconDeviceGamepad2,
  IconStar,
  IconClock,
  IconLoader2,
  IconTrash,
  IconChevronDown,
  IconRepeat,
} from '@tabler/icons-react'

const ce = React.createElement
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
}

const STATUS_LABELS = {
  playing:   'Playing',
  completed: 'Completed',
  dropped:   'Dropped',
}

const STATUS_OPTIONS = ['playing', 'completed', 'dropped']

export default function MyGames() {
  const [games, setGames]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [removing, setRemoving]     = useState(null)
  const [updating, setUpdating]     = useState(null)
  const [openMenu, setOpenMenu]     = useState(null)
  const [filter, setFilter]         = useState('all')
  const [activeGame, setActiveGame] = useState(null)   // game open in modal

  useEffect(() => {
    async function fetchLibrary() {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/library`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        })
        const data = await res.json()
        if (res.ok) setGames(data.filter(g => g.status === 'playing' || g.status === 'dropped'))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchLibrary()
  }, [])

  useEffect(() => {
    function handler(e) {
      if (!e.target.closest('.mg-status-menu')) setOpenMenu(null)
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
        if (status === 'completed') {
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

  const filterTabs = [
    { key: 'all',     label: 'All'     },
    { key: 'playing', label: 'Playing' },
    { key: 'dropped', label: 'Dropped' },
  ]

  const filtered = filter === 'all' ? games : games.filter(g => g.status === filter)

  if (loading) return ce('div', { className: 'mg-loading' },
    ce(IconLoader2, { size: 28, stroke: 1.5, className: 'mg-spin' })
  )

  return ce('div', { className: 'mg-wrapper' },

    ce('div', { className: 'mg-header' },
      ce('div', null,
        ce('h1', { className: 'mg-title' }, 'My Games'),
        ce('p',  { className: 'mg-sub'   }, `${games.length} game${games.length !== 1 ? 's' : ''} in progress`)
      ),
      ce('div', { className: 'mg-filters' },
        ...filterTabs.map(({ key, label }) =>
          ce('button', {
            key,
            className: `mg-filter-pill ${filter === key ? 'mg-filter-pill--active' : ''}`,
            onClick: () => setFilter(key)
          }, label)
        )
      )
    ),

    filtered.length === 0 && ce('div', { className: 'mg-empty' },
      ce(IconDeviceGamepad2, { size: 40, stroke: 1 }),
      ce('p',    null, filter === 'all' ? 'Nothing in progress' : `No ${filter} games`),
      ce('span', null, filter === 'all' ? 'Head to Discover to add a game' : 'Change your filter or add more games')
    ),

    filtered.length > 0 && ce('div', { className: 'mg-grid' },
      ...filtered.map(game =>
        ce('div', {
          key:       game.rawgId,
          className: 'mg-card',
          onClick:   () => setActiveGame(game),
          style:     { cursor: 'pointer' }
        },

          ce('div', {
            className: 'mg-card-cover',
            style: { backgroundImage: game.cover ? `url(${game.cover})` : 'none' }
          },
            !game.cover && ce('div', { className: 'mg-card-no-cover' },
              ce(IconDeviceGamepad2, { size: 36, stroke: 1 })
            ),
            ce('div', { className: 'mg-card-cover-overlay' }),

            ce('button', {
              className: 'mg-card-remove',
              onClick:   (e) => { e.stopPropagation(); removeGame(game.rawgId) },
              disabled:  removing === game.rawgId,
              title:     'Remove from library'
            },
              removing === game.rawgId
                ? ce(IconLoader2, { size: 13, stroke: 2, className: 'mg-spin' })
                : ce(IconTrash,   { size: 13, stroke: 2 })
            )
          ),

          ce('div', { className: 'mg-card-body' },
            ce('p', { className: 'mg-card-genre' },
              game.genres && game.genres.length > 0 ? game.genres.join(' · ') : 'Game'
            ),
            ce('h3', { className: 'mg-card-title' }, game.title),

            ce('div', { className: 'mg-card-meta' },
              game.rating   && ce('span', null, ce(IconStar,  { size: 12, stroke: 1.5 }), ' ', game.rating),
              game.playtime && ce('span', null, ce(IconClock, { size: 12, stroke: 1.5 }), ' ', game.playtime),
              game.released && ce('span', null, game.released)
            ),

            ce('div', { className: 'mg-playthroughs' },
              ce(IconRepeat, { size: 12, stroke: 1.5 }),
              ` ${game.playthroughs || 0} playthrough${(game.playthroughs || 0) !== 1 ? 's' : ''}`
            ),

            ce('div', { className: 'mg-status-menu' },
              ce('button', {
                className: `mg-status-btn mg-status-btn--${game.status}`,
                onClick:   (e) => { e.stopPropagation(); setOpenMenu(openMenu === game.rawgId ? null : game.rawgId) },
                disabled:  updating === game.rawgId
              },
                updating === game.rawgId
                  ? ce(IconLoader2, { size: 12, stroke: 2, className: 'mg-spin' })
                  : STATUS_LABELS[game.status],
                !updating && ce(IconChevronDown, { size: 12, stroke: 2 })
              ),
              openMenu === game.rawgId && ce('div', { className: 'mg-status-dropdown' },
                ...STATUS_OPTIONS.filter(s => s !== game.status).map(s =>
                  ce('button', {
                    key:       s,
                    className: 'mg-status-option',
                    onClick:   (e) => { e.stopPropagation(); changeStatus(game.rawgId, s) }
                  }, STATUS_LABELS[s])
                )
              )
            )
          )
        )
      )
    ),

    // Modal
    activeGame && ce(GameDetailModal, {
      game:       activeGame,
      isReadOnly: false,
      onClose:    () => setActiveGame(null)
    })
  )
}