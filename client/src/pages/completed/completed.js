import { requireAuth } from '../../shared/auth-guard.js'
import { renderNavbar } from '../../components/navbar.js'
import { authFetch } from '../../shared/api.js'
import { iconSvg } from '../../shared/icons.js'
import { openGameModal } from '../../components/game-detail-modal.js'

if (!(await requireAuth())) { /* redirected inside requireAuth */ }
else {
  await renderNavbar('completed')
  init()
}

const STATUS_LABELS = { playing: 'Playing', completed: 'Completed', dropped: 'Dropped' }
const STATUS_OPTIONS = ['playing', 'completed', 'dropped']

const state = {
  games: [],
  loading: true,
  removing: null,
  updating: null,
  openMenu: null,
}

const root = document.getElementById('completed-root')

async function init() {
  await fetchCompleted()

  window.addEventListener('click', (e) => {
    if (!e.target.closest('.cp-status-menu')) {
      state.openMenu = null
      render()
    }
  })
}

async function fetchCompleted() {
  state.loading = true
  render()
  try {
    const res = await authFetch('/library')
    const data = await res.json()
    if (res.ok) state.games = data.filter(g => g.status === 'completed')
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
      if (status !== 'completed') {
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
    <div class="cp-card" data-rawg-id="${rawgId}" style="cursor:pointer;">
      <div class="cp-card-cover" style="background-image:${cover ? `url(${cover})` : 'none'};">
        ${!cover ? `<div class="cp-card-no-cover">${iconSvg('device-gamepad-2', 36, 1)}</div>` : ''}
        <div class="cp-card-cover-overlay"></div>
        <div class="cp-cover-badge">${iconSvg('repeat', 11, 2)} ${playthroughs || 0}x</div>
        <button class="cp-card-remove" data-remove="${rawgId}" ${isRemoving ? 'disabled' : ''} title="Remove from library">
          ${isRemoving ? iconSvg('loader-2', 13, 2) : iconSvg('trash', 13, 2)}
        </button>
      </div>
      <div class="cp-card-body">
        <p class="cp-card-genre">${genres && genres.length > 0 ? genres.join(' · ') : 'Game'}</p>
        <h3 class="cp-card-title">${title}</h3>
        <div class="cp-card-meta">${metaParts}</div>
        <div class="cp-playthroughs">
          ${iconSvg('repeat', 12)} ${playthroughs || 0} playthrough${(playthroughs || 0) !== 1 ? 's' : ''}
        </div>
        <div class="cp-status-menu">
          <button class="cp-status-btn" data-status-toggle="${rawgId}" ${isUpdating ? 'disabled' : ''}>
            ${isUpdating ? iconSvg('loader-2', 12, 2) : STATUS_LABELS[status]}
            ${!isUpdating ? iconSvg('chevron-down', 12, 2) : ''}
          </button>
          ${isMenuOpen ? `
            <div class="cp-status-dropdown">
              ${dropdownOptions.map(s => `<button class="cp-status-option" data-status-set="${rawgId}|${s}">${STATUS_LABELS[s]}</button>`).join('')}
            </div>` : ''}
        </div>
      </div>
    </div>`
}

function render() {
  const { games, loading } = state

  if (loading) {
    root.innerHTML = `<div class="cp-loading">${iconSvg('loader-2', 28, 1.5)}</div>`
    return
  }

  const totalPlaythroughs = games.reduce((sum, g) => sum + (g.playthroughs || 0), 0)

  root.innerHTML = `
    <div class="cp-wrapper">
      <div class="cp-header">
        <div>
          <h1 class="cp-title">Completed</h1>
          <p class="cp-sub">
            ${games.length} game${games.length !== 1 ? 's' : ''} finished${totalPlaythroughs > 0 ? ` · ${totalPlaythroughs} total playthrough${totalPlaythroughs !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>

      ${games.length === 0 ? `
        <div class="cp-empty">
          ${iconSvg('trophy', 44, 1)}
          <p>No completed games yet</p>
          <span>Mark a game as Completed in My Games to see it here</span>
        </div>` : `
        <div class="cp-grid">${games.map(gameCard).join('')}</div>`}
    </div>
  `

  attachListeners()
}

function attachListeners() {
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

  document.querySelectorAll('.cp-card').forEach(el => {
    el.addEventListener('click', () => {
      const rawgId = el.dataset.rawgId
      const game = state.games.find(g => g.rawgId === rawgId)
      openGameModal(game, { isReadOnly: true, onClose: () => render() })
    })
  })
}