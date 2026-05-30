import React, { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
function Dashboard() {
  const { user, isAuthenticated } = useAuth0()
  const [message, setMessage] = useState('')
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
  return React.createElement('div', null,
    message && React.createElement('p', { style: { 
      color: message === 'Account successfully created' ? 'green' : 'orange',
      textAlign: 'center',
      padding: '10px',
      fontSize: '18px',
      fontWeight: 'bold'
    }}, message),
    React.createElement('div', null, 'Dashboard')
  )
}
export default Dashboard