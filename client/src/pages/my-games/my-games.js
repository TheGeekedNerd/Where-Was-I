import { requireAuth } from '../../shared/auth-guard.js'
import { renderNavbar } from '../../components/navbar.js'
import { authFetch } from '../../shared/api.js'
import { iconSvg } from '../../shared/icons.js'
import { openGameModal } from '../../components/game-detail-modal.js'


if (!(await requireAuth())) { /* redirected inside requireAuth */ }
else {
  await renderNavbar('my-games')
  init()
}

const STATUS_LABELS = { playing: 'Playing', paused: 'Paused', completed: 'Completed', dropped: 'Dropped' }
const STATUS_OPTIONS = ['playing', 'paused', 'completed', 'dropped']
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'playing', label: 'Playing' },
  { key: 'paused', label: 'Paused' },
  { key: 'dropped', label: 'Dropped' },
]

const state = {
  games: [],
  loading: true,
  removing: null,
  updating: null,
  openMenu: null,
  filter: 'all',
}

const root = document.getElementById('mygames-root')

async function init() {
  await fetchLibrary()

  // Close open status dropdown on outside click
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.mg-status-menu')) {
      state.openMenu = null
      render()
    }
  })
}

async function fetchLibrary() {
  state.loading = true
  render()
  try {
    const res = await authFetch('/library')
    const data = await res.json()
    if (res.ok) {
      state.games = data.filter(g => ['playing', 'paused', 'dropped'].includes(g.status))
    }
  } catch (err) {
    console.error(err)
  } finally {
    state.loading = false
    render()
  }
}

async function removeGame(rawgId) {
  state.removing = rawgId
  render()
  try {
    const res = await authFetch(`/library/${rawgId}`, { method: 'DELETE' })
    if (res.ok) state.games = state.games.filter(g => g.rawgId !== rawgId)
  } catch (err) {
    console.error(err)
  } finally {
    state.removing = null
    render()
  }
}

async function changeStatus(rawgId, status) {
  state.openMenu = null
  state.updating = rawgId
  render()
  try {
    const res = await authFetch(`/library/${rawgId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (res.ok) {
      if (status === 'completed') {
        state.games = state.games.filter(g => g.rawgId !== rawgId)
      } else {
        state.games = state.games.map(g =>
          g.rawgId === rawgId ? { ...g, status: data.status, playthroughs: data.playthroughs } : g
        )
      }
    }
  } catch (err) {
    console.error(err)
  } finally {
    state.updating = null
    render()
  }
}

function gameCard(game) {
  const { rawgId, cover, genres, title, rating, playtime, released, status, playthroughs } = game
  const isRemoving = state.removing === rawgId
  const isUpdating = state.updating === rawgId
  const isMenuOpen = state.openMenu === rawgId

  const metaParts = [
    rating ? `<span>${iconSvg('star', 12)} ${rating}</span>` : '',
    playtime ? `<span>${iconSvg('clock', 12)} ${playtime}</span>` : '',
    released ? `<span>${released}</span>` : '',
  ].join('')

  const dropdownOptions = STATUS_OPTIONS.filter(s => s !== status)

  return `
    <div class="mg-card" data-rawg-id="${rawgId}" style="cursor:pointer;">
      <div class="mg-card-cover" style="background-image:${cover ? `url(${cover})` : 'none'};">
        ${!cover ? `<div class="mg-card-no-cover">${iconSvg('device-gamepad-2', 36, 1)}</div>` : ''}
        <div class="mg-card-cover-overlay"></div>
        <button class="mg-card-remove" data-remove="${rawgId}" ${isRemoving ? 'disabled' : ''} title="Remove from library">
          ${isRemoving ? iconSvg('loader-2', 13, 2) : iconSvg('trash', 13, 2)}
        </button>
      </div>
      <div class="mg-card-body">
        <p class="mg-card-genre">${genres && genres.length > 0 ? genres.join(' · ') : 'Game'}</p>
        <h3 class="mg-card-title">${title}</h3>
        <div class="mg-card-meta">${metaParts}</div>
        <div class="mg-playthroughs">
          ${iconSvg('repeat', 12)} ${playthroughs || 0} playthrough${(playthroughs || 0) !== 1 ? 's' : ''}
        </div>
        <div class="mg-status-menu">
          <button class="mg-status-btn mg-status-btn--${status}" data-status-toggle="${rawgId}" ${isUpdating ? 'disabled' : ''}>
            ${isUpdating ? iconSvg('loader-2', 12, 2) : STATUS_LABELS[status]}
            ${!isUpdating ? iconSvg('chevron-down', 12, 2) : ''}
          </button>
          ${isMenuOpen ? `
            <div class="mg-status-dropdown">
              ${dropdownOptions.map(s => `<button class="mg-status-option" data-status-set="${rawgId}|${s}">${STATUS_LABELS[s]}</button>`).join('')}
            </div>` : ''}
        </div>
      </div>
    </div>`
}

function render() {
  const { games, loading, filter } = state

  if (loading) {
    root.innerHTML = `<div class="mg-loading">${iconSvg('loader-2', 28, 1.5)}</div>`
    return
  }

  const filtered = filter === 'all' ? games : games.filter(g => g.status === filter)

  root.innerHTML = `
    <div class="mg-wrapper">
      <div class="mg-header">
        <div>
          <h1 class="mg-title">My Games</h1>
          <p class="mg-sub">${games.length} game${games.length !== 1 ? 's' : ''} in progress</p>
        </div>
        <div class="mg-filters">
          ${FILTER_TABS.map(({ key, label }) => `
            <button class="mg-filter-pill ${filter === key ? 'mg-filter-pill--active' : ''}" data-filter="${key}">${label}</button>
          `).join('')}
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="mg-empty">
          ${iconSvg('device-gamepad-2', 40, 1)}
          <p>${filter === 'all' ? 'Nothing in progress' : `No ${filter} games`}</p>
          <span>${filter === 'all' ? 'Head to Discover to add a game' : 'Change your filter or add more games'}</span>
        </div>` : `
        <div class="mg-grid">
          ${filtered.map(gameCard).join('')}
        </div>`}
    </div>
  `

  attachListeners(filtered)
}

function attachListeners(filtered) {
  document.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => { state.filter = el.dataset.filter; render() })
  })

  document.querySelectorAll('[data-remove]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); removeGame(el.dataset.remove) })
  })

  document.querySelectorAll('[data-status-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = el.dataset.statusToggle
      state.openMenu = state.openMenu === id ? null : id
      render()
    })
  })

  document.querySelectorAll('[data-status-set]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const [rawgId, status] = el.dataset.statusSet.split('|')
      changeStatus(rawgId, status)
    })
  })

  document.querySelectorAll('.mg-card').forEach(el => {
    el.addEventListener('click', () => {
      const rawgId = el.dataset.rawgId
      const game = filtered.find(g => g.rawgId === rawgId)
      openGameModal(game, { isReadOnly: false, onClose: () => render() })
    })
  })
}