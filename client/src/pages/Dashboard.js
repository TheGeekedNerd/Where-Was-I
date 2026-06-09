import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import './Dashboard.css'
import Overview from './Overview'
import Discover from './Discover'
import Settings from './Settings'
import MyGames from './MyGames'   
import { IconSettings, IconDeviceGamepad2, IconLayoutDashboard, IconZoom, IconTrophy } from '@tabler/icons-react'
const ce = React.createElement
function Dashboard() {
  const { user, isAuthenticated } = useAuth0()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [activePage, setActivePage] = useState('overview')
  const [showSettings, setShowSettings] = useState(false)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  useEffect(() => {
  if (isAuthenticated && user && (user.sub.startsWith('google-oauth2') || user.sub.includes('discord'))) {
    fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, googleId: user.sub, username: user.name })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) localStorage.setItem('token', data.token)  // ← add this line
        setMessage(data.message)
        setTimeout(() => setMessage(''), 5000)
      })
  }
}, [isAuthenticated, user])
  const navLinks = [
    { key: 'overview',  Icon: IconLayoutDashboard, label: 'Overview'  },
    { key: 'my-games',  Icon: IconDeviceGamepad2,  label: 'My Games'  },
    { key: 'discover',  Icon: IconZoom,            label: 'Discover'  },
    { key: 'completed', Icon: IconTrophy,          label: 'Completed' },
    { key: 'settings',  Icon: IconSettings,        label: 'Settings'  },
  ]
  return ce('div', { className: 'dashboard-wrapper' },
    ce('nav', { className: 'navbar' },
      ce('span', { className: 'nav-logo' }, 'Where Was I'),
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
      )
    ),
    message && ce('p', {
      style: {
        color: message === 'Account successfully created' ? 'green' : 'orange',
        textAlign: 'center',
        padding: '10px',
        fontSize: '18px',
        fontWeight: 'bold'
      }
    }, message),
    ce('div', { className: 'dashboard-content' },
      activePage === 'overview'  && ce(Overview),
      activePage === 'my-games' && ce(MyGames),
      activePage === 'discover'  && ce(Discover),
      activePage === 'completed' && ce('div', null, 'Completed page'),
    ),
    showSettings && ce(Settings, { onClose: () => setShowSettings(false) })
  )
}
export default Dashboard