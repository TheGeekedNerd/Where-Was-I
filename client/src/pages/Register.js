import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './auth.css'

function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return React.createElement('div', { className: 'auth-wrapper' },

    React.createElement('div', { className: 'panel form-panel' },
      React.createElement('div', { className: 'form-box' },
        React.createElement('h1', { className: 'auth-title' }, 'Create account'),
        React.createElement('p', { className: 'auth-sub' }, 'Start tracking your games'),
        React.createElement('label', { className: 'field-label' }, 'Username'),
        React.createElement('input', { className: 'field-input', type: 'text', placeholder: 'TheGeekedNerd', onChange: (e) => setUsername(e.target.value) }),
        React.createElement('label', { className: 'field-label' }, 'Email'),
        React.createElement('input', { className: 'field-input', type: 'email', placeholder: 'you@email.com', onChange: (e) => setEmail(e.target.value) }),
        React.createElement('label', { className: 'field-label' }, 'Password'),
        React.createElement('input', { className: 'field-input', type: 'password', placeholder: '••••••••', onChange: (e) => setPassword(e.target.value) }),
        React.createElement('button', { className: 'primary-btn' }, 'Create account'),
        React.createElement('div', { className: 'divider' },
          React.createElement('div', { className: 'divider-line' }),
          React.createElement('span', { className: 'divider-text' }, 'or continue with'),
          React.createElement('div', { className: 'divider-line' })
        ),
        React.createElement('div', { className: 'social-row' },
          React.createElement('button', { className: 'social-btn' }, 'Google'),
          React.createElement('button', { className: 'social-btn' }, 'Discord')
        ),
        React.createElement('p', { className: 'switch-text' },
          'Already have an account? ',
          React.createElement('span', {
            className: 'switch-link',
            onClick: () => navigate('/login')
          }, 'Log in')
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
      React.createElement('div', { className: 'overlay' },

      )
    )
  )
}

export default Register