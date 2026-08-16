import { requireAuth } from '../../shared/auth-guard.js'
import { renderNavbar } from '../../components/navbar.js'
import { authFetch } from '../../shared/api.js'
import { iconSvg } from '../../shared/icons.js'

if (!(await requireAuth())) { /* redirected inside requireAuth */ }
else {
  await renderNavbar('overview')
  init()
}

const EVENT_META = {
  mission_completed: { icon: 'circle-check', color: '#00ff89' },
  game_started:      { icon: 'player-play',  color: '#00ff89' },
  game_resumed:      { icon: 'player-play',  color: '#00ff89' },
  game_paused:       { icon: 'clock',        color: '#ffd93d' },
  game_completed:    { icon: 'trophy',       color: '#a5a5ff' },
}

const UP_NEXT_META = {
  locked:      { icon: 'lock',        color: '#00ff89', label: 'Next chapter locked' },
  paused:      { icon: 'clock',       color: '#ffd93d', label: 'Ready to resume'     },
  ready:       { icon: 'player-play', color: '#00ff89', label: 'Ready to play'       },
  unavailable: { icon: 'sword',       color: '#555',    label: 'No structure yet'    },
}

const LIBRARY_FILTERS = ['All', 'Playing', 'Paused', 'Completed']

const state = {
  data: null,
  loading: true,
  error: null,
  libFilter: 'All',
  showAllActivity: false,
}

const root = document.getElementById('overview-root')

async function init() {
  await fetchOverview()
}

async function fetchOverview() {
  state.loading = true
  state.error = null
  render()
  try {
    const res = await authFetch('/overview')
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    state.data = await res.json()
  } catch (err) {
    state.error = err.message || 'Failed to load overview'
  } finally {
    state.loading = false
    render()
  }
}

async function handleShieldToggle(rawgId, newValue) {
  // Optimistic update
  state.data.games = state.data.games.map(g =>
    g.rawgId === rawgId ? { ...g, spoilerShield: newValue } : g
  )
  state.data.upNext = state.data.upNext.map(u =>
    u.rawgId === rawgId ? { ...u, tag: newValue ? 'locked' : 'ready' } : u
  )
  render()

  try {
    const res = await authFetch(`/library/${rawgId}/shield`, {
      method: 'PATCH',
      body: JSON.stringify({ spoilerShield: newValue }),
    })
    if (!res.ok) throw new Error('Shield update failed')
  } catch {
    fetchOverview() // rollback via refetch
  }
}

function goToGame(rawgId) {
  window.location.href = `/src/pages/game-detail/game-detail.html?id=${rawgId}`
}

function statsSkeleton() {
  return `<div class="ov-stats-row">${[0,1,2].map(() => `
    <div class="ov-stat-card">
      <div class="ov-skeleton ov-skel-icon"></div>
      <div class="ov-skeleton ov-skel-label"></div>
      <div class="ov-skeleton ov-skel-value"></div>
      <div class="ov-skeleton ov-skel-sub"></div>
    </div>`).join('')}</div>`
}

function gamesSkeleton() {
  return `<div class="ov-game-grid">${[0,1,2].map(() => `
    <div class="ov-game-card">
      <div class="ov-game-card__header">
        <div class="ov-skeleton ov-skel-thumb"></div>
        <div class="ov-game-card__info">
          <div class="ov-skeleton ov-skel-title"></div>
          <div class="ov-skeleton ov-skel-type"></div>
        </div>
      </div>
      <div class="ov-skeleton ov-skel-checkpoint"></div>
      <div class="ov-skeleton ov-skel-bar"></div>
    </div>`).join('')}</div>`
}

function statCard({ icon, label, value, sub }) {
  return `
    <div class="ov-stat-card">
      <div class="ov-stat-icon">${iconSvg(icon)}</div>
      <div class="ov-stat-label">${label}</div>
      <div class="ov-stat-value">${value}</div>
      <div class="ov-stat-sub">${sub}</div>
    </div>`
}

function gameCard(game) {
  if (game.add) {
    return `
      <div class="ov-game-card ov-game-card--add" data-add="true">
        ${iconSvg('plus', 22)}
        <span>Add a game</span>
      </div>`
  }

  const { rawgId, title, cover, typeLabel, status, progressPct, checkpointLabel, totalMissions, completedCount } = game
  const fillColor = status === 'playing' ? '#00ff89' : status === 'paused' ? '#ffd93d' : '#a5a5ff'
  const statusDisp = status.charAt(0).toUpperCase() + status.slice(1)

  const checkpointHtml = checkpointLabel
    ? `<div class="ov-game-card__checkpoint">${checkpointLabel}</div>`
    : totalMissions === 0
      ? `<div class="ov-game-card__checkpoint ov-game-card__checkpoint--dim">No story structure yet</div>`
      : ''

  return `
    <div class="ov-game-card" data-rawg-id="${rawgId}">
      <div class="ov-game-card__header">
        <div class="ov-game-card__thumb">
          ${cover
            ? `<img src="${cover}" alt="${title}" class="ov-game-card__cover" />`
            : `<div class="ov-game-card__cover-placeholder">${iconSvg('sword')}</div>`}
        </div>
        <div class="ov-game-card__info">
          <div class="ov-game-card__title">${title}</div>
          <div class="ov-game-card__type">${typeLabel}</div>
        </div>
        <span class="ov-badge ov-badge--${status}">${statusDisp}</span>
      </div>
      ${checkpointHtml}
      <div class="ov-progress-row">
        <div class="ov-progress-bar">
          <div class="ov-progress-fill" style="width:${progressPct}%; background:${fillColor};"></div>
        </div>
        <span class="ov-progress-pct" style="color:${fillColor};">${progressPct}%</span>
      </div>
      <div class="ov-game-card__footer">
        ${totalMissions > 0
          ? `<span class="ov-mission-count">${completedCount} / ${totalMissions} missions</span>`
          : `<span class="ov-mission-count ov-mission-count--dim">—</span>`}
      </div>
    </div>`
}

function render() {
  const { data, loading, error, libFilter, showAllActivity } = state

  const games = data?.games || []
  const filteredGames = libFilter === 'All' ? games : games.filter(g => g.status === libFilter.toLowerCase())
  const activity = data?.activity || []
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 3)
  const upNext = data?.upNext || []

  const stats = data ? [
    { icon: 'device-gamepad-2', label: 'Active games',    value: data.stats.active.value,         sub: data.stats.active.sub },
    { icon: 'trophy',           label: 'Completed',       value: data.stats.completed.value,      sub: data.stats.completed.sub },
    { icon: 'book-2',           label: 'Stories tracked', value: data.stats.storiesTracked.value, sub: data.stats.storiesTracked.sub },
  ] : []

  root.innerHTML = `
    <div class="overview">
      ${error ? `
        <div class="ov-error">
          ${iconSvg('alert-circle')}
          <span>${error}</span>
          <button class="ov-error__retry" id="retry-btn">Retry</button>
        </div>` : ''}

      ${loading ? statsSkeleton() : `
        <div class="ov-stats-row">${stats.map(statCard).join('')}</div>`}

      <section class="ov-section">
        <div class="ov-section-header">
          <h2 class="ov-section-title">Game library</h2>
          ${!loading ? `
            <div class="ov-filter-pills">
              ${LIBRARY_FILTERS.map(f => `
                <button class="ov-pill ${libFilter === f ? 'ov-pill--active' : ''}" data-filter="${f}">${f}</button>
              `).join('')}
            </div>` : ''}
        </div>

        ${loading ? gamesSkeleton() :
          (filteredGames.length === 0 && libFilter !== 'All')
            ? `<div class="ov-empty">No ${libFilter.toLowerCase()} games yet.</div>`
            : `<div class="ov-game-grid">
                ${filteredGames.map(gameCard).join('')}
                ${libFilter === 'All' ? gameCard({ add: true }) : ''}
              </div>`
        }
      </section>

      <div class="ov-bottom-grid">
        <section class="ov-section">
          <h2 class="ov-section-title">Recent activity</h2>
          ${loading ? `
            <div class="ov-activity-list">${[0,1,2].map(() => `
              <div class="ov-activity-item">
                <div class="ov-skeleton ov-skel-dot"></div>
                <div style="flex:1;">
                  <div class="ov-skeleton ov-skel-act-text"></div>
                  <div class="ov-skeleton ov-skel-act-time"></div>
                </div>
              </div>`).join('')}</div>`
          : activity.length === 0
            ? `<div class="ov-activity-list ov-empty-panel"><span>No activity yet — start playing a game!</span></div>`
            : `<div class="ov-activity-list">
                ${visibleActivity.map(a => {
                  const meta = EVENT_META[a.eventType] || EVENT_META['game_started']
                  return `
                    <div class="ov-activity-item">
                      <span class="ov-activity-dot" style="color:${meta.color};">${iconSvg(meta.icon, 14, 2)}</span>
                      <div>
                        <div class="ov-activity-text">${a.label}</div>
                        <div class="ov-activity-time">${a.time}</div>
                      </div>
                    </div>`
                }).join('')}
              </div>`
          }
          ${!loading && activity.length > 3 ? `
            <button class="ov-show-more" id="show-more-btn">
              ${iconSvg('chevron-down', 16, 2)}
            </button>` : ''}
        </section>

        <section class="ov-section">
          <h2 class="ov-section-title">Up next</h2>
          ${loading ? `
            <div class="ov-upnext-list">${[0,1].map(() => `
              <div class="ov-upnext-item">
                <div class="ov-skeleton ov-skel-un-title"></div>
                <div class="ov-skeleton ov-skel-un-sub"></div>
                <div class="ov-skeleton ov-skel-un-tag"></div>
              </div>`).join('')}</div>`
          : upNext.length === 0
            ? `<div class="ov-upnext-list ov-empty-panel"><span>Nothing active — add a game to get started.</span></div>`
            : `<div class="ov-upnext-list">
                ${upNext.map(u => {
                  const meta = UP_NEXT_META[u.tag] || UP_NEXT_META['ready']
                  return `
                    <div class="ov-upnext-item" data-rawg-id="${u.rawgId}">
                      <div class="ov-upnext-title">${u.title}</div>
                      <div class="ov-upnext-sub">${u.sub}</div>
                      <span class="ov-upnext-tag" style="color:${meta.color};">
                        ${iconSvg(meta.icon, 12, 2)} ${meta.label}
                      </span>
                    </div>`
                }).join('')}
              </div>`
          }
        </section>
      </div>
    </div>
  `

  attachListeners()
}

function attachListeners() {
  document.getElementById('retry-btn')?.addEventListener('click', fetchOverview)

  document.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => {
      state.libFilter = el.dataset.filter
      render()
    })
  })

  document.getElementById('show-more-btn')?.addEventListener('click', () => {
    state.showAllActivity = !state.showAllActivity
    render()
  })

  document.querySelectorAll('[data-rawg-id]').forEach(el => {
    el.addEventListener('click', () => goToGame(el.dataset.rawgId))
  })

  document.querySelector('[data-add="true"]')?.addEventListener('click', () => {
    window.location.href = '/src/pages/discover/discover.html'
  })
}