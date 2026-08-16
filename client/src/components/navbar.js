import { authFetch } from '../shared/api.js'
import { isAuth0Authenticated, getAuth0User } from '../shared/auth.js'
import { ensureBackendSession } from '../shared/session.js'

const NAV_LINKS = [
  { key: 'overview',  href: '/src/pages/overview/overview.html',   icon: 'layout-dashboard', label: 'Overview'  },
  { key: 'my-games',  href: '/src/pages/my-games/my-games.html',   icon: 'device-gamepad-2', label: 'My Games'  },
  { key: 'discover',  href: '/src/pages/discover/discover.html',   icon: 'zoom',              label: 'Discover'  },
  { key: 'completed', href: '/src/pages/completed/completed.html', icon: 'trophy',            label: 'Completed' },
]

// Assumes public/icons.svg is a sprite with <symbol id="tabler-<name>">.
// Adjust the "tabler-" prefix below if your sprite IDs differ.
function iconSvg(name, size = 18) {
  return `<svg width="${size}" height="${size}" class="icon" stroke-width="1.5"><use href="/icons.svg#tabler-${name}"></use></svg>`
}

export async function renderNavbar(activeKey) {
  const root = document.getElementById('navbar-root')
  if (!root) return

  root.innerHTML = `
    <nav class="navbar">
      <span class="nav-logo">Where Was I</span>
      <div class="nav-right">
        <div class="nav-links">
          ${NAV_LINKS.map(({ key, href, icon, label }) => `
            <a class="nav-link ${key === activeKey ? 'active' : ''}" href="${href}">
              ${iconSvg(icon)} ${label}
            </a>
          `).join('')}
        </div>
        <div class="nav-avatar" id="nav-avatar" title="Open settings"></div>
      </div>
    </nav>
    <p class="nav-message" id="nav-message" style="display:none;"></p>
  `

  document.getElementById('nav-avatar').addEventListener('click', () => {
    window.location.href = '/src/pages/settings/settings.html'
  })

  // Placeholder avatar icon until real avatar loads
  document.getElementById('nav-avatar').innerHTML = iconSvg('user')

  const message = await ensureBackendSession()
  if (message) {
    const msgEl = document.getElementById('nav-message')
    msgEl.textContent = message
    msgEl.style.color = message === 'Account successfully created' ? 'green' : 'orange'
    msgEl.style.display = 'block'
    setTimeout(() => { msgEl.style.display = 'none' }, 5000)
  }

  await loadAvatar()
}

async function loadAvatar() {
  const avatarEl = document.getElementById('nav-avatar')
  try {
    const res = await authFetch('/user/me')
    const data = await res.json()

    let avatarUrl = data.avatar
    if (!avatarUrl && (await isAuth0Authenticated())) {
      const user = await getAuth0User()
      avatarUrl = user?.picture || null
    }

    if (avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="avatar" class="nav-avatar-img" />`
    }
  } catch {
    // keep default icon on failure
  }
}