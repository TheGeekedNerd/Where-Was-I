import { authFetch, API } from '../shared/api.js'
import { iconSvg } from '../shared/icons.js'

let state = null

function onKeyDown(e) {
  if (e.key === 'Escape') closeModal()
}

export function openGameModal(game, { isReadOnly = false, onClose } = {}) {
  if (state) closeModal() // only one modal at a time

  state = {
    game,
    isReadOnly,
    onClose,
    structure: null,
    loading: true,
    error: null,       // null | 'unavailable' | 'fetch_failed'
    scraping: false,
    completing: null,
    resetting: false,
    showConfirm: false,
    openActs: {},       // actKey -> bool
  }

  document.body.insertAdjacentHTML('beforeend', '<div id="gdm-root"></div>')
  document.addEventListener('keydown', onKeyDown)

  render()
  fetchStructure()
}

function closeModal() {
  document.removeEventListener('keydown', onKeyDown)
  document.getElementById('gdm-root')?.remove()
  const cb = state?.onClose
  state = null
  if (cb) cb()
}

async function fetchStructure({ isScrapeAttempt = false } = {}) {
  if (isScrapeAttempt) state.scraping = true
  else state.loading = true
  state.error = null
  render()

  try {
    const res = await authFetch(`/structure/${state.game.rawgId}`)
    const data = await res.json()

    if (!res.ok) {
      state.error = data.status === 'unavailable' ? 'unavailable' : 'fetch_failed'
    } else {
      state.structure = data
      // Default open state: unlocked acts start open, matching the original
      data.acts.forEach((act, i) => {
        const key = act.id || i
        if (!(key in state.openActs)) state.openActs[key] = !act.locked
      })
    }
  } catch {
    state.error = 'fetch_failed'
  } finally {
    state.loading = false
    state.scraping = false
    render()
  }
}

async function completeMission(missionId) {
  state.completing = missionId
  render()
  try {
    const res = await authFetch(`/progress/${state.game.rawgId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    })
    if (res.ok) await fetchStructure()
  } catch (err) {
    console.error(err)
  } finally {
    state.completing = null
    render()
  }
}

async function resetProgress() {
  state.resetting = true
  render()
  try {
    const res = await authFetch(`/progress/${state.game.rawgId}/reset`, { method: 'DELETE' })
    if (res.ok) {
      state.showConfirm = false
      await fetchStructure()
    }
  } catch (err) {
    console.error(err)
  } finally {
    state.resetting = false
    render()
  }
}

// ── Render helpers ──────────────────────────────────────────────────────────

function progressBar(completed, total) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return `
    <div class="gdm-progress-wrap">
      <div class="gdm-progress-labels">
        <span>${completed} / ${total} missions</span>
        <span class="gdm-progress-pct">${pct}%</span>
      </div>
      <div class="gdm-progress-track">
        <div class="gdm-progress-fill" style="width:${pct}%;"></div>
      </div>
    </div>`
}

function missionRow(mission) {
  if (mission.locked) {
    return `
      <div class="gdm-mission gdm-mission--locked">
        <div class="gdm-mission-lock-icon">${iconSvg('lock', 11, 2)}</div>
        <span class="gdm-mission-title gdm-mission-title--blurred">${mission.title || 'Locked mission'}</span>
      </div>`
  }

  if (mission.completed) {
    return `
      <div class="gdm-mission gdm-mission--completed">
        <div class="gdm-mission-check">${iconSvg('check', 11, 2.5)}</div>
        <span class="gdm-mission-title">${mission.title}</span>
      </div>`
  }

  if (mission.current) {
    const isCompleting = state.completing === mission.id
    return `
      <div class="gdm-mission gdm-mission--current">
        <div class="gdm-mission-current-left"><div class="gdm-mission-dot"></div></div>
        <div class="gdm-mission-current-body">
          <div class="gdm-mission-current-top">
            <span class="gdm-mission-title">${mission.title}</span>
            ${!state.isReadOnly ? `
              <button class="gdm-mission-btn" data-complete="${mission.id}" ${isCompleting ? 'disabled' : ''} title="Mark as done">
                ${isCompleting ? iconSvg('loader-2', 12, 2) : 'Done'}
              </button>` : ''}
          </div>
          ${mission.description ? `<p class="gdm-mission-description">${mission.description}</p>` : ''}
        </div>
      </div>`
  }

  return `
    <div class="gdm-mission gdm-mission--upcoming">
      <div class="gdm-mission-upcoming-dot"></div>
      <span class="gdm-mission-title">${mission.title}</span>
    </div>`
}

function actSection(act, index) {
  const key = act.id || index
  const completedCount = act.missions.filter(m => m.completed).length
  const totalCount = act.missions.length
  const hasCurrent = act.missions.some(m => m.current)

  if (act.locked) {
    return `
      <div class="gdm-act gdm-act--locked">
        <div class="gdm-act-header gdm-act-header--locked">
          ${iconSvg('lock', 13, 2)}
          <span class="gdm-act-title gdm-act-title--blurred">${act.title || 'Locked chapter'}</span>
        </div>
      </div>`
  }

  const open = !!state.openActs[key]

  return `
    <div class="gdm-act ${hasCurrent ? 'gdm-act--active' : ''}">
      <button class="gdm-act-header" data-toggle-act="${key}">
        <div class="gdm-act-header-left">
          ${iconSvg(open ? 'chevron-down' : 'chevron-right', 14, 2)}
          <span class="gdm-act-title">${act.title}</span>
        </div>
        <span class="gdm-act-count">
          ${completedCount === totalCount ? iconSvg('check', 12, 2.5) : `${completedCount}/${totalCount}`}
        </span>
      </button>
      ${open ? `<div class="gdm-act-missions">${act.missions.map(missionRow).join('')}</div>` : ''}
    </div>`
}

function bodyContent() {
  const { loading, scraping, error, structure, isReadOnly, showConfirm, resetting } = state

  if (loading) {
    return `<div class="gdm-loading">${iconSvg('loader-2', 24, 1.5)}</div>`
  }

  if (scraping) {
    return `
      <div class="gdm-scraping">
        ${iconSvg('loader-2', 22, 1.5)}
        <p>Fetching chapters from wiki…</p>
        <span>This may take a few seconds</span>
      </div>`
  }

  if (error === 'unavailable') {
    return `
      <div class="gdm-no-structure">
        ${iconSvg('device-gamepad-2', 36, 1)}
        <p>No chapter data found for this game</p>
        <span>We checked PowerPyx, IGN and Fandom but couldn't parse a structure</span>
      </div>`
  }

  if (error === 'fetch_failed') {
    return `
      <div class="gdm-error">
        ${iconSvg('alert-triangle', 24, 1.5)}
        <p>Failed to load story structure</p>
        <button class="gdm-retry-btn" id="gdm-retry">Retry</button>
      </div>`
  }

  if (!structure) return ''

  const isFinished = structure.completedCount === structure.totalMissions && structure.totalMissions > 0

  return `
    ${progressBar(structure.completedCount, structure.totalMissions)}
    ${isFinished ? `<div class="gdm-finished-banner">🎮 You finished this one. Respect.</div>` : ''}
    ${!isReadOnly && structure.completedCount > 0 ? `
      <div class="gdm-reset-row">
        ${!showConfirm ? `
          <button class="gdm-reset-btn" id="gdm-reset-open">${iconSvg('rotate', 12, 2)} Reset progress</button>
        ` : `
          <div class="gdm-confirm-row">
            <span>Reset all progress?</span>
            <button class="gdm-confirm-yes" id="gdm-reset-yes" ${resetting ? 'disabled' : ''}>
              ${resetting ? iconSvg('loader-2', 12, 2) : 'Yes, reset'}
            </button>
            <button class="gdm-confirm-no" id="gdm-reset-no">Cancel</button>
          </div>`}
      </div>` : ''}
    <div class="gdm-acts">${structure.acts.map(actSection).join('')}</div>
  `
}

function render() {
  const root = document.getElementById('gdm-root')
  if (!root || !state) return

  const { game } = state

  root.innerHTML = `
    <div class="gdm-backdrop" id="gdm-backdrop">
      <div class="gdm-modal" role="dialog" aria-modal="true">
        <div class="gdm-cover" style="background-image:${game.cover ? `url(${game.cover})` : 'none'};">
          ${!game.cover ? `<div class="gdm-cover-fallback">${iconSvg('device-gamepad-2', 40, 1)}</div>` : ''}
          <div class="gdm-cover-overlay"></div>
          <div class="gdm-cover-meta">
            ${game.genres?.length > 0 ? `<span class="gdm-cover-genre">${game.genres[0]}</span>` : ''}
            <h2 class="gdm-cover-title">${game.title}</h2>
          </div>
          <button class="gdm-close" id="gdm-close" aria-label="Close">${iconSvg('x', 16, 2)}</button>
        </div>
        <div class="gdm-body">${bodyContent()}</div>
      </div>
    </div>`

  attachListeners()
}

function attachListeners() {
  document.getElementById('gdm-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'gdm-backdrop') closeModal()
  })
  document.getElementById('gdm-close').addEventListener('click', closeModal)
  document.getElementById('gdm-retry')?.addEventListener('click', () => fetchStructure())
  document.getElementById('gdm-reset-open')?.addEventListener('click', () => { state.showConfirm = true; render() })
  document.getElementById('gdm-reset-no')?.addEventListener('click', () => { state.showConfirm = false; render() })
  document.getElementById('gdm-reset-yes')?.addEventListener('click', resetProgress)

  document.querySelectorAll('[data-toggle-act]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.toggleAct
      state.openActs[key] = !state.openActs[key]
      render()
    })
  })

  document.querySelectorAll('[data-complete]').forEach(el => {
    el.addEventListener('click', () => completeMission(el.dataset.complete))
  })
}