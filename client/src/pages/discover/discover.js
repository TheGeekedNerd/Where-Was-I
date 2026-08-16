import { requireAuth } from '../../shared/auth-guard.js'
import { renderNavbar } from '../../components/navbar.js'
import { authFetch } from '../../shared/api.js'
import { iconSvg } from '../../shared/icons.js'

if (!(await requireAuth())) { /* redirected inside requireAuth */ }
else {
  await renderNavbar('discover')
  init()
}

const FILTERS = [
  { label: 'All', key: '' },
  { label: 'Action', key: 'action' },
  { label: 'RPG', key: 'rpg' },
  { label: 'Adventure', key: 'adventure' },
  { label: 'Horror', key: 'horror' },
  { label: 'Indie', key: 'indie' },
  { label: 'Open World', key: 'open-world' },
]

const state = {
  search: '',
  filter: FILTERS[0],
  games: [],
  loading: false,
  selected: null,
  added: new Set(),
  adding: false,
  page: 1,
  hasMore: false,
}

let debounceTimer = null
let abortController = null
const root = document.getElementById('discover-root')

function init() {
  render()
}

function debounceSearch(value) {
  state.search = value
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    state.page = 1
    state.games = []
    fetchGames()
  }, 400)
}

async function fetchGames() {
  if (abortController) abortController.abort()
  abortController = new AbortController()

  state.loading = true
  render()

  try {
    const params = new URLSearchParams({ page: state.page })
    if (state.search) params.set('query', state.search)
    if (state.filter.key) params.set('filter', state.filter.key)

    const res = await authFetch(`/games/search?${params}`, { signal: abortController.signal })
    const data = await res.json()

    state.games = state.page === 1 ? data.results : [...state.games, ...data.results]
    state.hasMore = !!data.hasMore
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e)
  } finally {
    state.loading = false
    render()
  }
}

async function openModal(game) {
  state.selected = { ...game, description: null }
  render()
  try {
    const res = await authFetch(`/games/${game.id}`)
    const data = await res.json()
    state.selected = { ...game, description: data.description, website: data.website }
  } catch {
    state.selected = { ...game, description: 'No description available.' }
  }
  render()
}

function closeModal() {
  state.selected = null
  render()
}

async function addGame(game) {
  if (state.added.has(game.id) || state.adding) return
  state.adding = true
  render()
  try {
    const res = await authFetch('/library', {
      method: 'POST',
      body: JSON.stringify({
        rawgId: game.id, // now an IGDB id — see field-name note
        title: game.title,
        cover: game.cover,
        rating: game.rating,
        released: game.released,
        genres: game.genres,
        platforms: game.platforms,
        playtime: game.playtime,
        slug: game.slug,
      }),
    })
    if (res.ok || res.status === 409) state.added.add(game.id)
  } catch (err) {
    console.error('Failed to add game:', err)
  } finally {
    state.adding = false
    closeModal()
  }
}

function changeFilter(f) {
  if (f.label === state.filter.label) return
  state.filter = f
  state.page = 1
  state.games = []
  fetchGames()
}

function loadMore() {
  state.page += 1
  fetchGames()
}

function modalHtml() {
  const s = state.selected
  if (!s) return ''
  return `
    <div class="disc-modal-overlay" id="disc-modal-overlay">
      <div class="disc-modal" id="disc-modal-inner">
        <div class="disc-modal-cover" style="background-image:${s.cover ? `url(${s.cover})` : 'none'};">
          <button class="disc-modal-close" id="disc-modal-close">${iconSvg('x', 18, 2)}</button>
          <div class="disc-modal-cover-overlay"></div>
        </div>
        <div class="disc-modal-body">
          <div class="disc-modal-genre-row">
            ${(s.genres || []).map(g => `<span class="disc-genre-tag">${g}</span>`).join('')}
            ${(s.platforms || []).map(p => `<span class="disc-platform-tag">${p}</span>`).join('')}
          </div>
          <h2 class="disc-modal-title">${s.title}</h2>
          ${s.description === null
            ? `<div class="disc-modal-loading">${iconSvg('loader-2', 18, 1.5)}</div>`
            : `<p class="disc-modal-desc">${s.description}</p>`}
          <div class="disc-modal-meta">
            ${s.rating ? `<div class="disc-meta-item">${iconSvg('star', 15)} <span>${s.rating} / 5</span></div>` : ''}
            ${s.playtime ? `<div class="disc-meta-item">${iconSvg('clock', 15)} <span>${s.playtime}</span></div>` : ''}
            ${s.released ? `<div class="disc-meta-item">${iconSvg('device-gamepad-2', 15)} <span>${s.released}</span></div>` : ''}
          </div>
          <button class="disc-modal-add ${state.added.has(s.id) ? 'disc-modal-add--done' : ''}" id="disc-modal-add" ${state.added.has(s.id) || state.adding ? 'disabled' : ''}>
            ${state.adding ? `${iconSvg('loader-2', 16, 2)} Adding...`
              : state.added.has(s.id) ? `${iconSvg('check', 16, 2)} Added to library`
              : `${iconSvg('plus', 16, 2)} Add to library`}
          </button>
        </div>
      </div>
    </div>`
}

function gameCard(g) {
  return `
    <div class="disc-card" data-game-id="${g.id}">
      <div class="disc-card-cover" style="background-image:${g.cover ? `url(${g.cover})` : 'none'};">
        ${!g.cover ? `<div class="disc-card-no-cover">${iconSvg('device-gamepad-2', 28, 1)}</div>` : ''}
        ${state.added.has(g.id) ? `<div class="disc-card-added-badge">${iconSvg('check', 12, 2)} Added</div>` : ''}
      </div>
      <div class="disc-card-body">
        <div class="disc-card-genre">${(g.genres || []).join(' · ') || 'Game'}</div>
        <div class="disc-card-title">${g.title}</div>
        <div class="disc-card-meta">
          ${g.rating ? `<span>${iconSvg('star', 12)} ${g.rating}</span>` : ''}
          ${g.playtime ? `<span>${iconSvg('clock', 12)} ${g.playtime}</span>` : ''}
        </div>
      </div>
    </div>`
}

function render() {
  const { search, filter, games, loading, hasMore } = state

  root.innerHTML = `
    <div class="discover">
      <div class="disc-header">
        <div>
          <h1 class="disc-title">Discover</h1>
          <p class="disc-sub">Search any game and add it to your library</p>
        </div>
        <div class="disc-search-wrap">
          ${iconSvg('search', 16, 1.5)}
          <input class="disc-search" id="disc-search-input" placeholder="Search games..." value="${search}" />
          ${search ? `<button class="disc-search-clear" id="disc-search-clear">${iconSvg('x', 14, 2)}</button>` : ''}
        </div>
      </div>

      <div class="disc-genres">
        ${FILTERS.map(f => `
          <button class="disc-genre-pill ${filter.label === f.label ? 'disc-genre-pill--active' : ''}" data-filter="${f.key}">${f.label}</button>
        `).join('')}
      </div>

      ${games.length === 0 && !loading ? `
        <div class="disc-empty">
          ${iconSvg('search', 32, 1)}
          <p>${search ? 'No games found' : 'Start searching'}</p>
          <span>${search ? 'Try a different title' : 'Type a game name above'}</span>
        </div>` : `
        <div class="disc-grid">${games.map(gameCard).join('')}</div>`}

      ${loading ? `<div class="disc-loading">${iconSvg('loader-2', 24, 1.5)}</div>` : ''}

      ${!loading && hasMore && games.length > 0 ? `
        <button class="disc-load-more" id="disc-load-more">Load more</button>` : ''}
    </div>
    ${modalHtml()}
  `

  attachListeners()
}

function attachListeners() {
  document.getElementById('disc-search-input')?.addEventListener('input', (e) => debounceSearch(e.target.value))

  document.getElementById('disc-search-clear')?.addEventListener('click', () => {
    state.search = ''
    state.page = 1
    state.games = []
    fetchGames()
  })

  document.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => changeFilter(FILTERS.find(f => f.key === el.dataset.filter)))
  })

  document.querySelectorAll('[data-game-id]').forEach(el => {
    el.addEventListener('click', () => {
      const game = state.games.find(g => g.id === Number(el.dataset.gameId))
      if (game) openModal(game)
    })
  })

  document.getElementById('disc-load-more')?.addEventListener('click', loadMore)
  document.getElementById('disc-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'disc-modal-overlay') closeModal()
  })
  document.getElementById('disc-modal-close')?.addEventListener('click', closeModal)
  document.getElementById('disc-modal-add')?.addEventListener('click', () => addGame(state.selected))
}