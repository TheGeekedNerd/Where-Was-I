import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import './Dashboard.css'
import Overview from './Overview'
import Discover from './Discover'
import Settings from './Settings'
import MyGames from './MyGames'
import Completed from './Completed'
import {
  IconSettings,
  IconDeviceGamepad2,
  IconLayoutDashboard,
  IconZoom,
  IconTrophy,
  IconUser,
} from '@tabler/icons-react'

const ce = React.createElement
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('token')
}

function Dashboard() {
  const { user, isAuthenticated } = useAuth0()
  const navigate = useNavigate()
  const [message, setMessage]           = useState('')
  const [activePage, setActivePage]     = useState('overview')
  const [showSettings, setShowSettings] = useState(false)
  const [avatar, setAvatar]             = useState(null)

  // Sync social users + get a JWT for them
  useEffect(() => {
    if (isAuthenticated && user && (user.sub.startsWith('google-oauth2') || user.sub.includes('discord'))) {
      fetch(`${API_URL}/auth/google`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: user.email, googleId: user.sub, username: user.name })
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) localStorage.setItem('token', data.token)
          setMessage(data.message)
          setTimeout(() => setMessage(''), 5000)
        })
    }
  }, [isAuthenticated, user])

  // Fetch avatar — for social users wait until token is set
  useEffect(() => {
    async function fetchAvatar() {
      const token = getToken()
      if (!token) return
      try {
        const res  = await fetch(`${API_URL}/user/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.avatar) {
          setAvatar(data.avatar)
        } else if (isAuthenticated && user?.picture) {
          setAvatar(user.picture)
        }
      } catch {}
    }

    const delay = isAuthenticated ? 800 : 0
    const t = setTimeout(fetchAvatar, delay)
    return () => clearTimeout(t)
  }, [isAuthenticated, user])

  function handleSettingsClose(updatedAvatar) {
    setShowSettings(false)
    if (updatedAvatar !== undefined) setAvatar(updatedAvatar)
  }

  const navLinks = [
    { key: 'overview',  Icon: IconLayoutDashboard, label: 'Overview'  },
    { key: 'my-games',  Icon: IconDeviceGamepad2,  label: 'My Games'  },
    { key: 'discover',  Icon: IconZoom,            label: 'Discover'  },
    { key: 'completed', Icon: IconTrophy,          label: 'Completed' },
  ]

  const avatarEl = ce('div', {
    className: 'nav-avatar',
    onClick:   () => setShowSettings(true),
    title:     'Open settings',
  },
    avatar
      ? ce('img', { src: avatar, alt: 'avatar', className: 'nav-avatar-img' })
      : ce(IconUser, { size: 18, stroke: 1.5 })
  )

  return ce('div', { className: 'dashboard-wrapper' },

    ce('nav', { className: 'navbar' },
      ce('span', { className: 'nav-logo' }, 'Where Was I'),
      ce('div', { className: 'nav-right' },
        ce('div', { className: 'nav-links' },
          ...navLinks.map(({ key, Icon, label }) =>
            ce('span', {
              key,
              className: `nav-link ${activePage === key && key !== 'settings' ? 'active' : ''} ${key === 'settings' && showSettings ? 'active' : ''}`,
              onClick: () => {
                if (key === 'settings') {
                  setShowSettings(true)
                } else {
                  setActivePage(key)
                }
              }
            },
              ce(Icon, { size: 18, stroke: 1.5 }),
              ' ' + label
            )
          )
        ),
        avatarEl
      )
    ),

    message && ce('p', {
      style: {
        color:      message === 'Account successfully created' ? 'green' : 'orange',
        textAlign:  'center',
        padding:    '10px',
        fontSize:   '18px',
        fontWeight: 'bold',
      }
    }, message),

    ce('div', { className: 'dashboard-content' },
      activePage === 'overview'  && ce(Overview, { onNavigate: setActivePage }),
      activePage === 'my-games'  && ce(MyGames),
      activePage === 'discover'  && ce(Discover),
      activePage === 'completed' && ce(Completed),
    ),

    showSettings && ce(Settings, {
      onClose:       handleSettingsClose,
      currentAvatar: avatar,
      socialPicture: isAuthenticated ? user?.picture : null,
    })
  )
}

export default Dashboard