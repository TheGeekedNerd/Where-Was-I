import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import './auth.css'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const { loginWithRedirect, isAuthenticated, user } = useAuth0()
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  // Handle Google redirect back to login page
  useEffect(() => {
    if (isAuthenticated && user) {
      fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, googleId: user.sub, username: user.name })
      })
        .then(res => res.json())
        .then(data => {
          if (data.message === 'Account does not exist') {
            navigate('/register', { state: { message: 'Account does not exist' } })
          } else {
            navigate('/dashboard')
          }
        })
    }
  }, [isAuthenticated, user])

  const handleLogin = async () => {
    if (!email || !password) return setMessage('Please fill in all fields')
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      setMessage(data.message)
      if (res.ok) navigate('/dashboard')
      if (res.status === 404) navigate('/register', { state: { message: 'Account does not exist' } })
    } catch (err) {
      setMessage('Server error')
    }
  }

  return React.createElement('div', { className: 'auth-wrapper' },
    React.createElement('div', { className: 'panel image-panel login-panel' },
      React.createElement('div', { className: 'slide slide-1 slide-odd' }),
      React.createElement('div', { className: 'slide slide-2 slide-even' }),
      React.createElement('div', { className: 'slide slide-3 slide-odd' }),
      React.createElement('div', { className: 'slide slide-4 slide-even' }),
      React.createElement('div', { className: 'slide slide-5 slide-odd' }),
      React.createElement('div', { className: 'slide slide-6 slide-even' }),
      React.createElement('div', { className: 'overlay' })
    ),
    React.createElement('div', { className: 'panel form-panel' },
      React.createElement('div', { className: 'form-box' },
        React.createElement('h1', { className: 'auth-title' }, 'Welcome back'),
        React.createElement('p', { className: 'auth-sub' }, 'Log in to your account'),
        message && React.createElement('p', { className: 'auth-message' }, message),
        React.createElement('label', { className: 'field-label' }, 'Email'),
        React.createElement('input', { className: 'field-input', type: 'email', placeholder: 'you@email.com', onChange: (e) => setEmail(e.target.value) }),
        React.createElement('label', { className: 'field-label' }, 'Password'),
        React.createElement('input', { className: 'field-input', type: 'password', placeholder: '••••••••', onChange: (e) => setPassword(e.target.value) }),
        React.createElement('button', { className: 'primary-btn', onClick: handleLogin }, 'Log in'),
        React.createElement('div', { className: 'divider' },
          React.createElement('div', { className: 'divider-line' }),
          React.createElement('span', { className: 'divider-text' }, 'or continue with'),
          React.createElement('div', { className: 'divider-line' })
        ),
        React.createElement('div', { className: 'social-row' },
          React.createElement('button', { className: 'social-btn', onClick: () => loginWithRedirect({ authorizationParams: { connection: 'google-oauth2' } }) }, 'Google'),
          React.createElement('button', { className: 'social-btn', onClick: () => loginWithRedirect({ authorizationParams: { connection: 'discord' } }) }, 'Discord')
        ),
        React.createElement('p', { className: 'switch-text' },
          "Don't have an account? ",
          React.createElement('span', { className: 'switch-link', onClick: () => navigate('/register') }, 'Register')
        )
      )
    )
  )
}
export default Login