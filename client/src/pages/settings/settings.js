import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
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

function createElement(tag, className, content = '') {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (typeof content === 'string') {
    el.innerHTML = content
  } else if (content) {
    el.appendChild(content)
  }
  return el
}

export default function Settings({ onClose, currentAvatar, socialPicture }) {
  const { user, isAuthenticated, logout } = useAuth0()
  const navigate = useNavigate()

  const isSocialUser = isAuthenticated && user &&
    (user.sub.startsWith('google-oauth2') || user.sub.includes('discord'))

  // State
  let state = {
    avatar: currentAvatar || socialPicture || null,
    avatarStatus: null,
    avatarUploading: false,
    displayName: isAuthenticated && user ? (user.name || user.nickname || '') : '',
    nameStatus: null,
    nameSaving: false,
    email: isAuthenticated && user ? (user.email || '') : '',
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

  // DOM refs
  let rootElement = document.getElementById('settings-root')
  
  function render() {
    rootElement.innerHTML = ''
    rootElement.appendChild(renderModal())
  }

  function renderModal() {
    const overlay = createElement('div', 'settings-overlay')
    overlay.addEventListener('click', handleOverlayClick)

    const modal = createElement('div', 'settings-modal')
    overlay.appendChild(modal)

    // Header
    const header = createElement('div', 'settings-header')
    const headerLeft = createElement('div')
    headerLeft.innerHTML = `
      <h2 class="settings-title">Settings</h2>
      <p class="settings-subtitle">Manage your account</p>
    `
    header.appendChild(headerLeft)

    const closeBtn = createElement('button', 'settings-close')
    closeBtn.innerHTML = '✕'
    closeBtn.addEventListener('click', () => onClose(state.avatar))
    header.appendChild(closeBtn)
    modal.appendChild(header)

    // Body
    const body = createElement('div', 'settings-body')
    modal.appendChild(body)

    // Avatar Section
    body.appendChild(renderAvatarSection())

    // Profile Section
    body.appendChild(renderProfileSection())

    // Email Section
    body.appendChild(renderEmailSection())

    // Password Section (if not social user)
    if (!isSocialUser) {
      body.appendChild(renderPasswordSection())
    }

    // Session Section
    body.appendChild(renderSessionSection())

    // Danger Zone
    body.appendChild(renderDangerZone())

    return overlay
  }

  function renderAvatarSection() {
    const section = createSection('Avatar')
    const row = createElement('div', 'settings-avatar-row')

    const wrap = createElement('div', 'settings-avatar-wrap')
    const avatarEl = state.avatar
      ? createElement('img', 'settings-avatar-img')
      : createElement('div', 'settings-avatar-placeholder', '👤')
    
    if (state.avatar) {
      avatarEl.src = state.avatar
      avatarEl.alt = 'avatar'
    }
    wrap.appendChild(avatarEl)

    const cameraBtn = createElement('button', `settings-avatar-camera ${state.avatarUploading ? 'settings-avatar-camera--loading' : ''}`)
    cameraBtn.textContent = state.avatarUploading ? '...' : '📷'
    cameraBtn.disabled = state.avatarUploading
    cameraBtn.addEventListener('click', () => fileInputRef.current?.click())
    wrap.appendChild(cameraBtn)

    const fileInput = createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    fileInput.addEventListener('change', handleAvatarChange)
    wrap.appendChild(fileInput)

    row.appendChild(wrap)

    const info = createElement('div', 'settings-avatar-info')
    const hint = createElement('p', 'settings-avatar-hint')
    hint.textContent = isSocialUser
      ? 'Showing your social login picture. Upload one to override it.'
      : 'Upload a profile picture.'
    info.appendChild(hint)
    info.appendChild(renderStatusMsg(state.avatarStatus))
    row.appendChild(info)

    section.appendChild(row)
    return section
  }

  function renderProfileSection() {
    const section = createSection('Profile')
    const field = createField('Display name')

    const row = createElement('div', 'settings-input-row')
    const wrap = createElement('div', 'settings-input-wrap')
    wrap.innerHTML = `
      <span class="settings-input-icon">👤</span>
      <input class="settings-input" type="text" 
        placeholder="Your display name" 
        ${isSocialUser ? 'disabled' : ''}
        value="${state.displayName}"
      />
    `
    const input = wrap.querySelector('input')
    input.addEventListener('input', (e) => {
      state.displayName = e.target.value
    })

    row.appendChild(wrap)

    if (!isSocialUser) {
      const saveBtn = createElement('button', `settings-save-btn ${state.nameSaving ? 'settings-save-btn--loading' : ''}`)
      saveBtn.textContent = state.nameSaving ? '...' : '✓'
      saveBtn.disabled = state.nameSaving
      saveBtn.addEventListener('click', saveDisplayName)
      row.appendChild(saveBtn)
    }

    field.appendChild(row)

    if (isSocialUser) {
      const hint = createElement('p', 'settings-hint')
      hint.textContent = 'Managed by your social login provider'
      field.appendChild(hint)
    } else {
      field.appendChild(renderStatusMsg(state.nameStatus))
    }

    section.appendChild(field)
    return section
  }

  function renderEmailSection() {
    const section = createSection('Email address')
    const field = createField('Email')

    const row = createElement('div', 'settings-input-row')
    const wrap = createElement('div', 'settings-input-wrap')
    wrap.innerHTML = `
      <span class="settings-input-icon">✉</span>
      <input class="settings-input" type="email" 
        placeholder="you@email.com" 
        ${isSocialUser ? 'disabled' : ''}
        value="${state.email}"
      />
    `
    const input = wrap.querySelector('input')
    input.addEventListener('input', (e) => {
      state.email = e.target.value
    })

    row.appendChild(wrap)

    if (!isSocialUser) {
      const saveBtn = createElement('button', `settings-save-btn ${state.emailSaving ? 'settings-save-btn--loading' : ''}`)
      saveBtn.textContent = state.emailSaving ? '...' : '✓'
      saveBtn.disabled = state.emailSaving
      saveBtn.addEventListener('click', saveEmail)
      row.appendChild(saveBtn)
    }

    field.appendChild(row)

    if (isSocialUser) {
      const hint = createElement('p', 'settings-hint')
      hint.textContent = 'Managed by your social login provider'
      field.appendChild(hint)
    } else {
      field.appendChild(renderStatusMsg(state.emailStatus))
    }

    section.appendChild(field)
    return section
  }

  function renderPasswordSection() {
    const section = createSection('Password')

    const fields = [
      { label: 'Current password', value: state.currentPassword, setter: (v) => state.currentPassword = v },
      { label: 'New password', value: state.newPassword, setter: (v) => state.newPassword = v },
      { label: 'Confirm new password', value: state.confirmPassword, setter: (v) => state.confirmPassword = v },
    ]

    fields.forEach(({ label, value, setter }) => {
      const field = createField(label)
      const wrap = createElement('div', 'settings-input-wrap')
      wrap.innerHTML = `
        <span class="settings-input-icon">🔒</span>
        <input class="settings-input" type="password" 
          placeholder="••••••••••" 
          value="${value}"
        />
      `
      const input = wrap.querySelector('input')
      input.addEventListener('input', (e) => setter(e.target.value))
      field.appendChild(wrap)
      section.appendChild(field)
    })

    section.appendChild(renderStatusMsg(state.passwordStatus))

    const changeBtn = createElement('button', `settings-action-btn ${state.passwordSaving ? 'settings-action-btn--loading' : ''}`)
    changeBtn.textContent = state.passwordSaving ? 'Saving...' : 'Change password'
    changeBtn.disabled = state.passwordSaving
    changeBtn.addEventListener('click', savePassword)
    section.appendChild(changeBtn)

    return section
  }

  function renderSessionSection() {
    const section = createSection('Session')
    const logoutBtn = createElement('button', 'settings-logout-btn')
    logoutBtn.innerHTML = '🚪 Log out'
    logoutBtn.addEventListener('click', handleLogout)
    section.appendChild(logoutBtn)
    return section
  }

  function renderDangerZone() {
    const section = createSection('Danger zone')

    if (!state.showDeleteZone) {
      const toggleBtn = createElement('button', 'settings-danger-toggle')
      toggleBtn.innerHTML = '🗑 Delete account'
      toggleBtn.addEventListener('click', () => {
        state.showDeleteZone = true
        render()
      })
      section.appendChild(toggleBtn)
    } else {
      const zone = createElement('div', 'settings-delete-zone')
      
      const warning = createElement('div', 'settings-delete-warning')
      warning.innerHTML = `
        <span>⚠</span>
        <span>This permanently deletes your account and all data. Type <strong>DELETE</strong> to confirm.</span>
      `
      zone.appendChild(warning)

      const row = createElement('div', 'settings-input-row')
      const input = createElement('input', 'settings-input settings-input--danger')
      input.type = 'text'
      input.placeholder = 'Type DELETE'
      input.value = state.deleteConfirm
      input.addEventListener('input', (e) => {
        state.deleteConfirm = e.target.value
      })
      row.appendChild(input)

      const deleteBtn = createElement('button', `settings-delete-confirm-btn ${state.deleteDeleting ? 'settings-delete-confirm-btn--loading' : ''}`)
      deleteBtn.textContent = state.deleteDeleting ? '...' : '🗑'
      deleteBtn.disabled = state.deleteDeleting
      deleteBtn.addEventListener('click', handleDeleteAccount)
      row.appendChild(deleteBtn)
      zone.appendChild(row)

      zone.appendChild(renderStatusMsg(state.deleteStatus))

      const cancelBtn = createElement('button', 'settings-cancel-link')
      cancelBtn.textContent = 'Cancel'
      cancelBtn.addEventListener('click', () => {
        state.showDeleteZone = false
        state.deleteConfirm = ''
        state.deleteStatus = null
        render()
      })
      zone.appendChild(cancelBtn)

      section.appendChild(zone)
    }

    return section
  }

  // Helper functions
  function createSection(title) {
    const section = createElement('div', 'settings-section')
    const heading = createElement('h3', 'settings-section-title', title)
    section.appendChild(heading)
    return section
  }

  function createField(label) {
    const field = createElement('div', 'settings-field')
    const labelEl = createElement('label', 'settings-label', label)
    field.appendChild(labelEl)
    return field
  }

  function renderStatusMsg(msg) {
    const p = createElement('p')
    if (!msg) {
      p.style.display = 'none'
      return p
    }
    p.className = `settings-status ${msg.type === 'error' ? 'settings-status--error' : 'settings-status--ok'}`
    p.textContent = msg.text
    return p
  }

  // Event handlers
  function handleOverlayClick(e) {
    if (e.target.classList.contains('settings-overlay')) {
      onClose(state.avatar)
    }
  }

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
      const res = await fetch(`${API_URL}/user/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
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
      e.target.value = ''
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
      const res = await fetch(`${API_URL}/user/update-username`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ username: state.displayName.trim() })
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
      const res = await fetch(`${API_URL}/user/update-email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ email: state.email.trim() })
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
      const res = await fetch(`${API_URL}/user/change-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword: state.currentPassword, newPassword: state.newPassword })
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

  function handleLogout() {
    localStorage.removeItem('token')
    if (isAuthenticated) {
      logout({ logoutParams: { returnTo: window.location.origin + '/login' } })
    } else {
      navigate('/login')
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
      const res = await fetch(`${API_URL}/user/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      if (res.ok) {
        localStorage.removeItem('token')
        if (isAuthenticated) {
          logout({ logoutParams: { returnTo: window.location.origin + '/login' } })
        } else {
          navigate('/login')
        }
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

  // Load user data
  useEffect(() => {
    if (!isSocialUser && getToken()) {
      fetch(`${API_URL}/user/me`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.username) state.displayName = data.username
          if (data.email) state.email = data.email
          if (data.avatar) state.avatar = data.avatar
          render()
        })
        .catch(() => {})
    }
  }, [])

  // Initial render
  render()

  // Close on Escape
  const escapeHandler = (e) => {
    if (e.key === 'Escape') onClose(state.avatar)
  }
  window.addEventListener('keydown', escapeHandler)

  return () => {
    window.removeEventListener('keydown', escapeHandler)
  }
}