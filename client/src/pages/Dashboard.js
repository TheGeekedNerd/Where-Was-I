import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import './Dashboard.css'
import Overview from './Overview'
import { IconSettings, IconDeviceGamepad2, IconLayoutDashboard, IconZoom, IconTrophy } from '@tabler/icons-react'

function Dashboard() {
  const { user, isAuthenticated } = useAuth0()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [activePage, setActivePage] = useState('overview')
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
          setMessage(data.message)
          setTimeout(() => setMessage(''), 5000)
        })
    }
  }, [isAuthenticated, user])

  const navLinks = [
    { key: 'overview',   Icon: IconLayoutDashboard, label: 'Overview' },
    { key: 'my-games',   Icon: IconDeviceGamepad2,  label: 'My Games' },
    { key: 'discover',   Icon: IconZoom,            label: 'Discover' },
    { key: 'completed',  Icon: IconTrophy,          label: 'Completed' },
    { key: 'settings',   Icon: IconSettings,        label: 'Settings' },
  ]

  return React.createElement('div', { className: 'dashboard-wrapper' },
    React.createElement('nav', { className: 'navbar' },
      React.createElement('span', { className: 'nav-logo' }, 'Where Was I'),
      React.createElement('div', { className: 'nav-links' },
        ...navLinks.map(({ key, Icon, label }) =>
          React.createElement('span', {
            key,
            className: `nav-link ${activePage === key ? 'active' : ''}`,
            onClick: () => setActivePage(key)
          },
            React.createElement(Icon, { size: 18, stroke: 1.5 }),
            ' ' + label
          )
        )
      )
    ),

    message && React.createElement('p', {
      style: {
        color: message === 'Account successfully created' ? 'green' : 'orange',
        textAlign: 'center',
        padding: '10px',
        fontSize: '18px',
        fontWeight: 'bold'
      }
    }, message),

    React.createElement('div', { className: 'dashboard-content' },
      activePage === 'overview'  && React.createElement(Overview),
      activePage === 'my-games'  && React.createElement('div', null, 'My Games page'),
      activePage === 'discover'  && React.createElement('div', null, 'Discover page'),
      activePage === 'completed' && React.createElement('div', null, 'Completed page'),
      activePage === 'settings'  && React.createElement('div', null, 'Settings page')
    )
  )
}

export default Dashboard