import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './auth.css'

function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const handleSubmit = async () => {
    if (!email) return (setMessage('Please enter your email'), setIsError(true))
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      setMessage(data.message)
      setIsError(!res.ok)
    } catch {
      setMessage('Server error')
      setIsError(true)
    } finally {
      setLoading(false)
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
        React.createElement('h1', { className: 'auth-title' }, 'Forgot password'),
        React.createElement('p', { className: 'auth-sub' }, "Enter your email and we'll send you a reset link"),
        message && React.createElement('p', {
          className: 'auth-message',
          style: { color: isError ? '#e74c3c' : '#00ff89' }
        }, message),
        React.createElement('label', { className: 'field-label' }, 'Email'),
        React.createElement('input', {
          className: 'field-input',
          type: 'email',
          placeholder: 'you@email.com',
          onChange: (e) => setEmail(e.target.value)
        }),
        React.createElement('button', {
          className: 'primary-btn',
          onClick: handleSubmit,
          disabled: loading
        }, loading ? 'Sending…' : 'Send reset link'),
        React.createElement('p', { className: 'switch-text' },
          React.createElement('span', {
            className: 'switch-link',
            onClick: () => navigate('/login')
          }, '← Back to login')
        )
      )
    )
  )
}

export default ForgotPassword