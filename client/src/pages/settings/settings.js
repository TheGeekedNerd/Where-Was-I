import { requireAuth } from '../../shared/auth-guard.js'
import { renderNavbar } from '../../components/navbar.js'
import { authFetch } from '../../shared/api.js'
import { isAuth0Authenticated, getAuth0User, logout } from '../../shared/auth.js'

if (!(await requireAuth())) { /* redirected inside requireAuth */ }
else {
  await renderNavbar('settings')
  init()
}

const state = {
  isSocialUser: false,
  avatar: null,
  avatarStatus: null,
  avatarUploading: false,
  displayName: '',
  nameStatus: null,
  nameSaving: false,
  email: '',
  emailStatus: null,
  emailSaving: false,
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  passwordStatus: null,
  passwordSaving: false,
  deleteConfirm: '',
  deleteStatus: null,
  deleteDeleting: false,
  showDeleteZone: false,
}

const root = document.getElementById('settings-root')

async function init() {
  const authed = await isAuth0Authenticated()
  if (authed) {
    const user = await getAuth0User()
    state.isSocialUser = !!(user?.sub?.startsWith('google-oauth2') || user?.sub?.includes('discord'))
    state.avatar = user?.picture || null
    if (state.isSocialUser) {
      state.displayName = user?.name || user?.nickname || ''
      state.email = user?.email || ''
    }
  }

  render()

  if (!state.isSocialUser) {
    try {
      const res = await authFetch('/user/me')
      const data = await res.json()
      if (data.username) state.displayName = data.username
      if (data.email) state.email = data.email
      if (data.avatar) state.avatar = data.avatar
      render()
    } catch { /* keep defaults on failure */ }
  }

  document.addEventListener('keydown', onKeyDown)
}

function onKeyDown(e) {
  if (e.key === 'Escape') goBack()
}

function goBack() {
  window.location.href = '/src/pages/overview/overview.html'
}

function resizeImage(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Actions ──────────────────────────────────────────────────────────────

async function handleAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    state.avatarStatus = { type: 'error', text: 'Please select an image file' }
    render()
    return
  }
  state.avatarUploading = true
  state.avatarStatus = null
  render()

  try {
    const base64 = await resizeImage(file, 200)
    const res = await authFetch('/user/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar: base64 }),
    })
    if (res.ok) {
      state.avatar = base64
      state.avatarStatus = { type: 'ok', text: 'Avatar updated' }
    } else {
      const data = await res.json()
      state.avatarStatus = { type: 'error', text: data.message || 'Failed to upload' }
    }
  } catch {
    state.avatarStatus = { type: 'error', text: 'Upload failed' }
  } finally {
    state.avatarUploading = false
    render()
  }
}

async function saveDisplayName() {
  if (!state.displayName.trim()) {
    state.nameStatus = { type: 'error', text: 'Name cannot be empty' }
    render()
    return
  }
  state.nameSaving = true
  state.nameStatus = null
  render()

  try {
    const res = await authFetch('/user/update-username', {
      method: 'PATCH',
      body: JSON.stringify({ username: state.displayName.trim() }),
    })
    const data = await res.json()
    state.nameStatus = res.ok
      ? { type: 'ok', text: 'Display name updated' }
      : { type: 'error', text: data.message || 'Failed to update name' }
  } catch {
    state.nameStatus = { type: 'error', text: 'Server error' }
  } finally {
    state.nameSaving = false
    render()
  }
}

async function saveEmail() {
  if (!state.email.trim()) {
    state.emailStatus = { type: 'error', text: 'Email cannot be empty' }
    render()
    return
  }
  state.emailSaving = true
  state.emailStatus = null
  render()

  try {
    const res = await authFetch('/user/update-email', {
      method: 'PATCH',
      body: JSON.stringify({ email: state.email.trim() }),
    })
    const data = await res.json()
    state.emailStatus = res.ok
      ? { type: 'ok', text: 'Email updated' }
      : { type: 'error', text: data.message || 'Failed to update email' }
  } catch {
    state.emailStatus = { type: 'error', text: 'Server error' }
  } finally {
    state.emailSaving = false
    render()
  }
}

async function savePassword() {
  if (!state.currentPassword || !state.newPassword || !state.confirmPassword) {
    state.passwordStatus = { type: 'error', text: 'Fill in all password fields' }
    render()
    return
  }
  if (state.newPassword !== state.confirmPassword) {
    state.passwordStatus = { type: 'error', text: 'New passwords do not match' }
    render()
    return
  }
  state.passwordSaving = true
  state.passwordStatus = null
  render()

  try {
    const res = await authFetch('/user/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: state.currentPassword, newPassword: state.newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      state.passwordStatus = { type: 'ok', text: 'Password changed' }
      state.currentPassword = ''
      state.newPassword = ''
      state.confirmPassword = ''
    } else {
      state.passwordStatus = { type: 'error', text: data.message || 'Failed to change password' }
    }
  } catch {
    state.passwordStatus = { type: 'error', text: 'Server error' }
  } finally {
    state.passwordSaving = false
    render()
  }
}

async function handleDeleteAccount() {
  if (state.deleteConfirm !== 'DELETE') {
    state.deleteStatus = { type: 'error', text: 'Type DELETE to confirm' }
    render()
    return
  }
  state.deleteDeleting = true
  state.deleteStatus = null
  render()

  try {
    const res = await authFetch('/user/delete', { method: 'DELETE' })
    if (res.ok) {
      await logout()
    } else {
      const data = await res.json()
      state.deleteStatus = { type: 'error', text: data.message || 'Failed to delete account' }
    }
  } catch {
    state.deleteStatus = { type: 'error', text: 'Server error' }
  } finally {
    state.deleteDeleting = false
    render()
  }
}

// ── Render ───────────────────────────────────────────────────────────────

function statusMsg(msg) {
  if (!msg) return ''
  return `<p class="settings-status ${msg.type === 'error' ? 'settings-status--error' : 'settings-status--ok'}">${msg.text}</p>`
}

function render() {
  const s = state

  root.innerHTML = `
    <div class="settings-modal">
      <div class="settings-header">
        <div>
          <h2 class="settings-title">Settings</h2>
          <p class="settings-subtitle">Manage your account</p>
        </div>
        <button class="settings-close" id="settings-close">✕</button>
      </div>

      <div class="settings-body">

        <div class="settings-section">
          <h3 class="settings-section-title">Avatar</h3>
          <div class="settings-avatar-row">
            <div class="settings-avatar-wrap">
              ${s.avatar
                ? `<img class="settings-avatar-img" src="${s.avatar}" alt="avatar" />`
                : `<div class="settings-avatar-placeholder">👤</div>`}
              <button class="settings-avatar-camera ${s.avatarUploading ? 'settings-avatar-camera--loading' : ''}" id="avatar-camera-btn" ${s.avatarUploading ? 'disabled' : ''}>
                ${s.avatarUploading ? '...' : '📷'}
              </button>
              <input type="file" accept="image/*" id="avatar-file-input" style="display:none;" />
            </div>
            <div class="settings-avatar-info">
              <p class="settings-avatar-hint">${s.isSocialUser ? 'Showing your social login picture. Upload one to override it.' : 'Upload a profile picture.'}</p>
              ${statusMsg(s.avatarStatus)}
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Profile</h3>
          <div class="settings-field">
            <label class="settings-label">Display name</label>
            <div class="settings-input-row">
              <div class="settings-input-wrap">
                <span class="settings-input-icon">👤</span>
                <input class="settings-input" type="text" id="displayname-input" placeholder="Your display name" ${s.isSocialUser ? 'disabled' : ''} value="${s.displayName}" />
              </div>
              ${!s.isSocialUser ? `
                <button class="settings-save-btn ${s.nameSaving ? 'settings-save-btn--loading' : ''}" id="save-name-btn" ${s.nameSaving ? 'disabled' : ''}>
                  ${s.nameSaving ? '...' : '✓'}
                </button>` : ''}
            </div>
            ${s.isSocialUser
              ? `<p class="settings-hint">Managed by your social login provider</p>`
              : statusMsg(s.nameStatus)}
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Email address</h3>
          <div class="settings-field">
            <label class="settings-label">Email</label>
            <div class="settings-input-row">
              <div class="settings-input-wrap">
                <span class="settings-input-icon">✉</span>
                <input class="settings-input" type="email" id="email-input" placeholder="you@email.com" ${s.isSocialUser ? 'disabled' : ''} value="${s.email}" />
              </div>
              ${!s.isSocialUser ? `
                <button class="settings-save-btn ${s.emailSaving ? 'settings-save-btn--loading' : ''}" id="save-email-btn" ${s.emailSaving ? 'disabled' : ''}>
                  ${s.emailSaving ? '...' : '✓'}
                </button>` : ''}
            </div>
            ${s.isSocialUser
              ? `<p class="settings-hint">Managed by your social login provider</p>`
              : statusMsg(s.emailStatus)}
          </div>
        </div>

        ${!s.isSocialUser ? `
          <div class="settings-section">
            <h3 class="settings-section-title">Password</h3>
            <div class="settings-field">
              <label class="settings-label">Current password</label>
              <div class="settings-input-wrap">
                <span class="settings-input-icon">🔒</span>
                <input class="settings-input" type="password" id="current-password-input" placeholder="••••••••••" value="${s.currentPassword}" />
              </div>
            </div>
            <div class="settings-field">
              <label class="settings-label">New password</label>
              <div class="settings-input-wrap">
                <span class="settings-input-icon">🔒</span>
                <input class="settings-input" type="password" id="new-password-input" placeholder="••••••••••" value="${s.newPassword}" />
              </div>
            </div>
            <div class="settings-field">
              <label class="settings-label">Confirm new password</label>
              <div class="settings-input-wrap">
                <span class="settings-input-icon">🔒</span>
                <input class="settings-input" type="password" id="confirm-password-input" placeholder="••••••••••" value="${s.confirmPassword}" />
              </div>
            </div>
            ${statusMsg(s.passwordStatus)}
            <button class="settings-action-btn ${s.passwordSaving ? 'settings-action-btn--loading' : ''}" id="change-password-btn" ${s.passwordSaving ? 'disabled' : ''}>
              ${s.passwordSaving ? 'Saving...' : 'Change password'}
            </button>
          </div>` : ''}

        <div class="settings-section">
          <h3 class="settings-section-title">Session</h3>
          <button class="settings-logout-btn" id="logout-btn">🚪 Log out</button>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Danger zone</h3>
          ${!s.showDeleteZone ? `
            <button class="settings-danger-toggle" id="delete-toggle-btn">🗑 Delete account</button>
          ` : `
            <div class="settings-delete-zone">
              <div class="settings-delete-warning">
                <span>⚠</span>
                <span>This permanently deletes your account and all data. Type <strong>DELETE</strong> to confirm.</span>
              </div>
              <div class="settings-input-row">
                <input class="settings-input settings-input--danger" type="text" id="delete-confirm-input" placeholder="Type DELETE" value="${s.deleteConfirm}" />
                <button class="settings-delete-confirm-btn ${s.deleteDeleting ? 'settings-delete-confirm-btn--loading' : ''}" id="delete-confirm-btn" ${s.deleteDeleting ? 'disabled' : ''}>
                  ${s.deleteDeleting ? '...' : '🗑'}
                </button>
              </div>
              ${statusMsg(s.deleteStatus)}
              <button class="settings-cancel-link" id="delete-cancel-btn">Cancel</button>
            </div>`}
        </div>

      </div>
    </div>
  `

  attachListeners()
}

function attachListeners() {
  document.getElementById('settings-close').addEventListener('click', goBack)

  const fileInput = document.getElementById('avatar-file-input')
  document.getElementById('avatar-camera-btn').addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', handleAvatarChange)

  document.getElementById('displayname-input')?.addEventListener('input', (e) => { state.displayName = e.target.value })
  document.getElementById('save-name-btn')?.addEventListener('click', saveDisplayName)

  document.getElementById('email-input')?.addEventListener('input', (e) => { state.email = e.target.value })
  document.getElementById('save-email-btn')?.addEventListener('click', saveEmail)

  document.getElementById('current-password-input')?.addEventListener('input', (e) => { state.currentPassword = e.target.value })
  document.getElementById('new-password-input')?.addEventListener('input', (e) => { state.newPassword = e.target.value })
  document.getElementById('confirm-password-input')?.addEventListener('input', (e) => { state.confirmPassword = e.target.value })
  document.getElementById('change-password-btn')?.addEventListener('click', savePassword)

  document.getElementById('logout-btn').addEventListener('click', () => logout())

  document.getElementById('delete-toggle-btn')?.addEventListener('click', () => {
    state.showDeleteZone = true
    render()
  })
  document.getElementById('delete-cancel-btn')?.addEventListener('click', () => {
    state.showDeleteZone = false
    state.deleteConfirm = ''
    state.deleteStatus = null
    render()
  })
  document.getElementById('delete-confirm-input')?.addEventListener('input', (e) => { state.deleteConfirm = e.target.value })
  document.getElementById('delete-confirm-btn')?.addEventListener('click', handleDeleteAccount)
}