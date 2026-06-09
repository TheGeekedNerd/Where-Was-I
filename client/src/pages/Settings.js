import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { IconX, IconUser, IconMail, IconLock, IconLogout, IconTrash, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import './Settings.css'

const ce = React.createElement

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
}

function Section({ title, children }) {
  return ce('div', { className: 'settings-section' },
    ce('h3', { className: 'settings-section-title' }, title),
    children
  )
}

function Field({ label, children }) {
  return ce('div', { className: 'settings-field' },
    ce('label', { className: 'settings-label' }, label),
    children
  )
}

function StatusMsg({ msg }) {
  if (!msg) return null
  const isError = msg.type === 'error'
  return ce('p', { className: `settings-status ${isError ? 'settings-status--error' : 'settings-status--ok'}` },
    msg.text
  )
}

export default function Settings({ onClose }) {
  const { user, isAuthenticated, logout } = useAuth0()
  const navigate = useNavigate()

  const isSocialUser = isAuthenticated && user &&
    (user.sub.startsWith('google-oauth2') || user.sub.includes('discord'))

  // Display name
  const [displayName, setDisplayName] = useState(
    isAuthenticated && user ? (user.name || user.nickname || '') : ''
  )
  const [nameStatus, setNameStatus] = useState(null)
  const [nameSaving, setNameSaving] = useState(false)

  // Email
  const [email, setEmail] = useState(
    isAuthenticated && user ? (user.email || '') : ''
  )
  const [emailStatus, setEmailStatus] = useState(null)
  const [emailSaving, setEmailSaving] = useState(false)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus]   = useState(null)
  const [passwordSaving, setPasswordSaving]   = useState(false)

  // Delete
  const [deleteConfirm, setDeleteConfirm]   = useState('')
  const [deleteStatus, setDeleteStatus]     = useState(null)
  const [deleteDeleting, setDeleteDeleting] = useState(false)
  const [showDeleteZone, setShowDeleteZone] = useState(false)

  // Load username from token-based account
  useEffect(() => {
    if (!isSocialUser && getToken()) {
      fetch(`${API_URL}/user/me`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.username) setDisplayName(data.username)
          if (data.email)    setEmail(data.email)
        })
        .catch(() => {})
    }
  }, [])

  // Close on Escape
  const overlayRef = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  async function saveDisplayName() {
    if (!displayName.trim()) return setNameStatus({ type: 'error', text: 'Name cannot be empty' })
    setNameSaving(true)
    setNameStatus(null)
    try {
      const res = await fetch(`${API_URL}/user/update-username`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ username: displayName.trim() })
      })
      const data = await res.json()
      setNameStatus(res.ok
        ? { type: 'ok', text: 'Display name updated' }
        : { type: 'error', text: data.message || 'Failed to update name' }
      )
    } catch {
      setNameStatus({ type: 'error', text: 'Server error' })
    } finally {
      setNameSaving(false)
    }
  }

  async function saveEmail() {
    if (!email.trim()) return setEmailStatus({ type: 'error', text: 'Email cannot be empty' })
    setEmailSaving(true)
    setEmailStatus(null)
    try {
      const res = await fetch(`${API_URL}/user/update-email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      setEmailStatus(res.ok
        ? { type: 'ok', text: 'Email updated' }
        : { type: 'error', text: data.message || 'Failed to update email' }
      )
    } catch {
      setEmailStatus({ type: 'error', text: 'Server error' })
    } finally {
      setEmailSaving(false)
    }
  }

  async function savePassword() {
    if (!currentPassword || !newPassword || !confirmPassword)
      return setPasswordStatus({ type: 'error', text: 'Fill in all password fields' })
    if (newPassword !== confirmPassword)
      return setPasswordStatus({ type: 'error', text: 'New passwords do not match' })
    setPasswordSaving(true)
    setPasswordStatus(null)
    try {
      const res = await fetch(`${API_URL}/user/change-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setPasswordStatus({ type: 'ok', text: 'Password changed' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordStatus({ type: 'error', text: data.message || 'Failed to change password' })
      }
    } catch {
      setPasswordStatus({ type: 'error', text: 'Server error' })
    } finally {
      setPasswordSaving(false)
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
    if (deleteConfirm !== 'DELETE')
      return setDeleteStatus({ type: 'error', text: 'Type DELETE to confirm' })
    setDeleteDeleting(true)
    setDeleteStatus(null)
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
        setDeleteStatus({ type: 'error', text: data.message || 'Failed to delete account' })
      }
    } catch {
      setDeleteStatus({ type: 'error', text: 'Server error' })
    } finally {
      setDeleteDeleting(false)
    }
  }

  return ce('div', { className: 'settings-overlay', ref: overlayRef, onClick: handleOverlayClick },
    ce('div', { className: 'settings-modal' },

      // Header
      ce('div', { className: 'settings-header' },
        ce('div', null,
          ce('h2', { className: 'settings-title' }, 'Settings'),
          ce('p', { className: 'settings-subtitle' }, 'Manage your account')
        ),
        ce('button', { className: 'settings-close', onClick: onClose },
          ce(IconX, { size: 18 })
        )
      ),

      ce('div', { className: 'settings-body' },

        // Display Name
        ce(Section, { title: 'Profile' },
          ce(Field, { label: 'Display name' },
            ce('div', { className: 'settings-input-row' },
              ce('div', { className: 'settings-input-wrap' },
                ce(IconUser, { size: 15, className: 'settings-input-icon' }),
                ce('input', {
                  className: 'settings-input',
                  type: 'text',
                  value: displayName,
                  placeholder: 'Your display name',
                  disabled: isSocialUser,
                  onChange: (e) => setDisplayName(e.target.value)
                })
              ),
              !isSocialUser && ce('button', {
                className: `settings-save-btn ${nameSaving ? 'settings-save-btn--loading' : ''}`,
                onClick: saveDisplayName,
                disabled: nameSaving
              }, nameSaving ? '...' : ce(IconCheck, { size: 15 }))
            ),
            isSocialUser
              ? ce('p', { className: 'settings-hint' }, 'Managed by your social login provider')
              : ce(StatusMsg, { msg: nameStatus })
          )
        ),

        // Email
        ce(Section, { title: 'Email address' },
          ce(Field, { label: 'Email' },
            ce('div', { className: 'settings-input-row' },
              ce('div', { className: 'settings-input-wrap' },
                ce(IconMail, { size: 15, className: 'settings-input-icon' }),
                ce('input', {
                  className: 'settings-input',
                  type: 'email',
                  value: email,
                  placeholder: 'you@email.com',
                  disabled: isSocialUser,
                  onChange: (e) => setEmail(e.target.value)
                })
              ),
              !isSocialUser && ce('button', {
                className: `settings-save-btn ${emailSaving ? 'settings-save-btn--loading' : ''}`,
                onClick: saveEmail,
                disabled: emailSaving
              }, emailSaving ? '...' : ce(IconCheck, { size: 15 }))
            ),
            isSocialUser
              ? ce('p', { className: 'settings-hint' }, 'Managed by your social login provider')
              : ce(StatusMsg, { msg: emailStatus })
          )
        ),

        // Password
        !isSocialUser && ce(Section, { title: 'Password' },
          ce(Field, { label: 'Current password' },
            ce('div', { className: 'settings-input-wrap' },
              ce(IconLock, { size: 15, className: 'settings-input-icon' }),
              ce('input', {
                className: 'settings-input',
                type: 'password',
                value: currentPassword,
                placeholder: '••••••••••',
                onChange: (e) => setCurrentPassword(e.target.value)
              })
            )
          ),
          ce(Field, { label: 'New password' },
            ce('div', { className: 'settings-input-wrap' },
              ce(IconLock, { size: 15, className: 'settings-input-icon' }),
              ce('input', {
                className: 'settings-input',
                type: 'password',
                value: newPassword,
                placeholder: '••••••••••',
                onChange: (e) => setNewPassword(e.target.value)
              })
            )
          ),
          ce(Field, { label: 'Confirm new password' },
            ce('div', { className: 'settings-input-wrap' },
              ce(IconLock, { size: 15, className: 'settings-input-icon' }),
              ce('input', {
                className: 'settings-input',
                type: 'password',
                value: confirmPassword,
                placeholder: '••••••••••',
                onChange: (e) => setConfirmPassword(e.target.value)
              })
            )
          ),
          ce(StatusMsg, { msg: passwordStatus }),
          ce('button', {
            className: `settings-action-btn ${passwordSaving ? 'settings-action-btn--loading' : ''}`,
            onClick: savePassword,
            disabled: passwordSaving
          }, passwordSaving ? 'Saving...' : 'Change password')
        ),

        // Logout
        ce(Section, { title: 'Session' },
          ce('button', { className: 'settings-logout-btn', onClick: handleLogout },
            ce(IconLogout, { size: 15 }),
            'Log out'
          )
        ),

        // Delete Account
        ce(Section, { title: 'Danger zone' },
          !showDeleteZone
            ? ce('button', { className: 'settings-danger-toggle', onClick: () => setShowDeleteZone(true) },
                ce(IconTrash, { size: 14 }),
                'Delete account'
              )
            : ce('div', { className: 'settings-delete-zone' },
                ce('div', { className: 'settings-delete-warning' },
                  ce(IconAlertTriangle, { size: 15 }),
                  ce('span', null, 'This permanently deletes your account and all data. Type ',
                    ce('strong', null, 'DELETE'),
                    ' to confirm.'
                  )
                ),
                ce('div', { className: 'settings-input-row' },
                  ce('input', {
                    className: 'settings-input settings-input--danger',
                    type: 'text',
                    placeholder: 'Type DELETE',
                    value: deleteConfirm,
                    onChange: (e) => setDeleteConfirm(e.target.value)
                  }),
                  ce('button', {
                    className: `settings-delete-confirm-btn ${deleteDeleting ? 'settings-delete-confirm-btn--loading' : ''}`,
                    onClick: handleDeleteAccount,
                    disabled: deleteDeleting
                  }, deleteDeleting ? '...' : ce(IconTrash, { size: 15 }))
                ),
                ce(StatusMsg, { msg: deleteStatus }),
                ce('button', {
                  className: 'settings-cancel-link',
                  onClick: () => { setShowDeleteZone(false); setDeleteConfirm(''); setDeleteStatus(null) }
                }, 'Cancel')
              )
        )
      )
    )
  )
}