import React, { useState, useEffect, useRef } from 'react'
import './Discover.css'
import {
  IconSearch,
  IconX,
  IconPlus,
  IconCheck,
  IconClock,
  IconStar,
  IconDeviceGamepad2,
  IconLoader2,
} from '@tabler/icons-react'

const ce = React.createElement
const RAWG_KEY = import.meta.env.VITE_RAWG_API_KEY
const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
}

const GENRES = [
  { label: 'All',        slug: '',                       tag: ''           },
  { label: 'Action',     slug: 'action',                 tag: ''           },
  { label: 'RPG',        slug: 'role-playing-games-rpg', tag: ''           },
  { label: 'Adventure',  slug: 'adventure',              tag: ''           },
  { label: 'Horror',     slug: '',                       tag: 'horror'     },
  { label: 'Indie',      slug: 'indie',                  tag: ''           },
  { label: 'Open World', slug: '',                       tag: 'open-world' },
]

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Discover() {
  const [search, setSearch]     = useState('')
  const [genre, setGenre]       = useState(GENRES[0])
  const [games, setGames]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [added, setAdded]       = useState(new Set())
  const [adding, setAdding]     = useState(false)
  const [page, setPage]         = useState(1)
  const [hasMore, setHasMore]   = useState(false)

  const debouncedSearch = useDebounce(search, 400)
  const abortRef        = useRef(null)
  const seenIds         = useRef(new Set())

  // Reset everything when search or genre changes
  useEffect(() => {
    seenIds.current = new Set()
    setGames([])
    setPage(1)
    setHasMore(false)
  }, [debouncedSearch, genre])

  // Fetch when page is ready (after reset or load more)
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    async function fetchGames() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          key:      RAWG_KEY,
          page_size: 20,
          page,
          ordering: debouncedSearch ? '-relevance' : '-rating',
        })
        if (debouncedSearch) params.set('search',  debouncedSearch)
        if (genre.slug)      params.set('genres',  genre.slug)
        params.set('tags', genre.tag ? `${genre.tag},story-rich,linear` : 'story-rich,linear')

        const res  = await fetch(`https://api.rawg.io/api/games?${params}`, { signal: abortRef.current.signal })
        const data = await res.json()

        const fresh = (data.results || []).filter(g => {
          if (seenIds.current.has(g.id)) return false
          seenIds.current.add(g.id)
          return true
        })

        const normalized = fresh.map(g => ({
          id:        g.id,
          title:     g.name,
          cover:     g.background_image,
          rating:    g.rating ? g.rating.toFixed(1) : null,
          released:  g.released ? g.released.slice(0, 4) : null,
          genres:    g.genres?.map(x => x.name).slice(0, 2) || [],
          platforms: g.platforms?.map(x => x.platform.name).slice(0, 3) || [],
          playtime:  g.playtime ? `~${g.playtime} hrs` : null,
          slug:      g.slug,
        }))

        setGames(prev => page === 1 ? normalized : [...prev, ...normalized])
        setHasMore(!!data.next)
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e)
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [debouncedSearch, genre, page])

  async function fetchDetail(game) {
    try {
      const res  = await fetch(`https://api.rawg.io/api/games/${game.slug}?key=${RAWG_KEY}`)
      const data = await res.json()
      const desc = data.description_raw || ''
      setSelected({
        ...game,
        description: desc.length > 300 ? desc.slice(0, 300) + '...' : desc || 'No description available.',
        website: data.website || null,
      })
    } catch {
      setSelected({ ...game, description: 'No description available.' })
    }
  }

  function openModal(game) {
    setSelected({ ...game, description: null })
    fetchDetail(game)
  }

  function closeModal() { setSelected(null) }

  async function addGame(game) {
    if (added.has(game.id) || adding) return
    setAdding(true)
    try {
      const res = await fetch(`${API_URL}/library`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          rawgId:    game.id,
          title:     game.title,
          cover:     game.cover,
          rating:    game.rating,
          released:  game.released,
          genres:    game.genres,
          platforms: game.platforms,
          playtime:  game.playtime,
          slug:      game.slug,
        }),
      })
      if (res.ok || res.status === 409) {
        setAdded(prev => new Set([...prev, game.id]))
      }
    } catch (err) {
      console.error('Failed to add game:', err)
    } finally {
      setAdding(false)
      closeModal()
    }
  }

  function handleGenreChange(g) {
    if (g.label === genre.label) return
    setGenre(g)
  }

  // ── Modal ──
  const modal = selected && ce('div', { className: 'disc-modal-overlay', onClick: closeModal },
    ce('div', { className: 'disc-modal', onClick: e => e.stopPropagation() },
      ce('div', {
        className: 'disc-modal-cover',
        style: { backgroundImage: selected.cover ? `url(${selected.cover})` : 'none' }
      },
        ce('button', { className: 'disc-modal-close', onClick: closeModal },
          ce(IconX, { size: 18, stroke: 2 })
        ),
        ce('div', { className: 'disc-modal-cover-overlay' }),
      ),
      ce('div', { className: 'disc-modal-body' },
        ce('div', { className: 'disc-modal-genre-row' },
          ...selected.genres.map(g   => ce('span', { key: g, className: 'disc-genre-tag'    }, g)),
          ...selected.platforms.map(p => ce('span', { key: p, className: 'disc-platform-tag' }, p)),
        ),
        ce('h2', { className: 'disc-modal-title' }, selected.title),
        selected.description === null
          ? ce('div', { className: 'disc-modal-loading' }, ce(IconLoader2, { size: 18, stroke: 1.5, className: 'disc-spin' }))
          : ce('p',  { className: 'disc-modal-desc'    }, selected.description),
        ce('div', { className: 'disc-modal-meta' },
          selected.rating   && ce('div', { className: 'disc-meta-item' }, ce(IconStar,           { size: 15, stroke: 1.5 }), ce('span', null, `${selected.rating} / 5`)),
          selected.playtime && ce('div', { className: 'disc-meta-item' }, ce(IconClock,          { size: 15, stroke: 1.5 }), ce('span', null, selected.playtime)),
          selected.released && ce('div', { className: 'disc-meta-item' }, ce(IconDeviceGamepad2, { size: 15, stroke: 1.5 }), ce('span', null, selected.released)),
        ),
        ce('button', {
          className: `disc-modal-add ${added.has(selected.id) ? 'disc-modal-add--done' : ''}`,
          onClick:   () => addGame(selected),
          disabled:  added.has(selected.id) || adding,
        },
          adding
            ? ce(React.Fragment, null, ce(IconLoader2, { size: 16, stroke: 2, className: 'disc-spin' }), ' Adding...')
            : added.has(selected.id)
              ? ce(React.Fragment, null, ce(IconCheck, { size: 16, stroke: 2 }), ' Added to library')
              : ce(React.Fragment, null, ce(IconPlus,  { size: 16, stroke: 2 }), ' Add to library')
        ),
      ),
    )
  )

  // ── Page ──
  return ce('div', { className: 'discover' },

    ce('div', { className: 'disc-header' },
      ce('div', null,
        ce('h1', { className: 'disc-title' }, 'Discover'),
        ce('p',  { className: 'disc-sub'   }, 'Search any game and add it to your library'),
      ),
      ce('div', { className: 'disc-search-wrap' },
        ce(IconSearch, { size: 16, stroke: 1.5, className: 'disc-search-icon' }),
        ce('input', {
          className:   'disc-search',
          placeholder: 'Search 500,000+ games...',
          value:       search,
          onChange:    e => setSearch(e.target.value),
        }),
        search && ce('button', { className: 'disc-search-clear', onClick: () => setSearch('') },
          ce(IconX, { size: 14, stroke: 2 })
        ),
      ),
    ),

    ce('div', { className: 'disc-genres' },
      ...GENRES.map(g =>
        ce('button', {
          key:       g.label,
          className: `disc-genre-pill ${genre.label === g.label ? 'disc-genre-pill--active' : ''}`,
          onClick:   () => handleGenreChange(g),
        }, g.label)
      )
    ),

    games.length === 0 && !loading
      ? ce('div', { className: 'disc-empty' },
          ce(IconSearch, { size: 32, stroke: 1 }),
          ce('p',    null, search ? 'No games found' : 'Start searching'),
          ce('span', null, search ? 'Try a different title' : 'Type a game name above'),
        )
      : ce('div', { className: 'disc-grid' },
          ...games.map(g =>
            ce('div', { key: g.id, className: 'disc-card', onClick: () => openModal(g) },
              ce('div', {
                className: 'disc-card-cover',
                style: { backgroundImage: g.cover ? `url(${g.cover})` : 'none' }
              },
                !g.cover && ce('div', { className: 'disc-card-no-cover' },
                  ce(IconDeviceGamepad2, { size: 28, stroke: 1 })
                ),
                added.has(g.id) && ce('div', { className: 'disc-card-added-badge' },
                  ce(IconCheck, { size: 12, stroke: 2 }), ' Added'
                ),
              ),
              ce('div', { className: 'disc-card-body' },
                ce('div', { className: 'disc-card-genre' }, g.genres.join(' · ') || 'Game'),
                ce('div', { className: 'disc-card-title' }, g.title),
                ce('div', { className: 'disc-card-meta' },
                  g.rating   && ce('span', null, ce(IconStar,  { size: 12, stroke: 1.5 }), ' ', g.rating),
                  g.playtime && ce('span', null, ce(IconClock, { size: 12, stroke: 1.5 }), ' ', g.playtime),
                ),
              ),
            )
          ),
        ),

    loading && ce('div', { className: 'disc-loading' },
      ce(IconLoader2, { size: 24, stroke: 1.5, className: 'disc-spin' })
    ),

    !loading && hasMore && games.length > 0 && ce('button', {
      className: 'disc-load-more',
      onClick:   () => setPage(p => p + 1),
    }, 'Load more'),

    modal,
  )
}