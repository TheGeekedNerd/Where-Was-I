import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import './auth.css'

function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithRedirect } = useAuth0()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(location.state?.message || '')
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const handleRegister = async () => {
    if (!username || !email || !password) return setMessage('Please fill in all fields')
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      })
      const data = await res.json()
      setMessage(data.message)
      if (res.status === 201) setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      setMessage('Server error')
    }
  }

  return React.createElement('div', { className: 'auth-wrapper' },
    React.createElement('div', { className: 'panel form-panel' },
      React.createElement('div', { className: 'form-box' },
        React.createElement('h1', { className: 'auth-title' }, 'Create account'),
        React.createElement('p', { className: 'auth-sub' }, 'Start tracking your games'),
        message && React.createElement('p', { className: 'auth-message' }, message),
        React.createElement('label', { className: 'field-label' }, 'Username'),
        React.createElement('input', { className: 'field-input', type: 'text', placeholder: 'TheGeekedNerd', onChange: (e) => setUsername(e.target.value) }),
        React.createElement('label', { className: 'field-label' }, 'Email'),
        React.createElement('input', { className: 'field-input', type: 'email', placeholder: 'you@email.com', onChange: (e) => setEmail(e.target.value) }),
        React.createElement('label', { className: 'field-label' }, 'Password'),
        React.createElement('input', { className: 'field-input', type: 'password', placeholder: '••••••••', onChange: (e) => setPassword(e.target.value) }),
        React.createElement('button', { className: 'primary-btn', onClick: handleRegister }, 'Create account'),
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
          'Already have an account? ',
          React.createElement('span', { className: 'switch-link', onClick: () => navigate('/login') }, 'Log in')
        )
      )
    ),
    React.createElement('div', { className: 'panel image-panel register-panel' },
      React.createElement('div', { className: 'slide slide-1 slide-odd' }),
      React.createElement('div', { className: 'slide slide-2 slide-even' }),
      React.createElement('div', { className: 'slide slide-3 slide-odd' }),
      React.createElement('div', { className: 'slide slide-4 slide-even' }),
      React.createElement('div', { className: 'slide slide-5 slide-odd' }),
      React.createElement('div', { className: 'slide slide-6 slide-even' }),
      React.createElement('div', { className: 'overlay' })
    )
  )
}
export default Register