import React, { useState } from 'react'
import './Login.css'

function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  return React.createElement('div', { className: `auth-wrapper ${isLogin ? '' : 'reversed'}` },

    React.createElement('div', { className: 'panel image-panel' },
      React.createElement('div', { className: 'slide slide-1' }),
      React.createElement('div', { className: 'slide slide-2' }),
      React.createElement('div', { className: 'slide slide-3' }),
      React.createElement('div', { className: 'overlay' },
        React.createElement('h2', { className: 'overlay-title' }, 'Where Was I?'),
        React.createElement('p', { className: 'overlay-sub' }, 'Track your story. No spoilers.')
      )
    ),

    React.createElement('div', { className: 'panel form-panel' },
      isLogin
        ? React.createElement('div', { className: 'form-box' },
            React.createElement('h1', { className: 'auth-title' }, 'Welcome back'),
            React.createElement('p', { className: 'auth-sub' }, 'Log in to your account'),
            React.createElement('label', { className: 'field-label' }, 'Email'),
            React.createElement('input', { className: 'field-input', type: 'email', placeholder: 'you@email.com', onChange: (e) => setEmail(e.target.value) }),
            React.createElement('label', { className: 'field-label' }, 'Password'),
            React.createElement('input', { className: 'field-input', type: 'password', placeholder: '••••••••', onChange: (e) => setPassword(e.target.value) }),
            React.createElement('button', { className: 'primary-btn' }, 'Log in'),
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
              "Don't have an account? ",
              React.createElement('span', { className: 'switch-link', onClick: () => setIsLogin(false) }, 'Register')
            )
          )
        : React.createElement('div', { className: 'form-box' },
            React.createElement('h1', { className: 'auth-title' }, 'Create account'),
            React.createElement('p', { className: 'auth-sub' }, 'Start tracking your games'),
            React.createElement('label', { className: 'field-label' }, 'Username'),
            React.createElement('input', { className: 'field-input', type: 'text', placeholder: 'your username', onChange: (e) => setUsername(e.target.value) }),
            React.createElement('label', { className: 'field-label' }, 'Email'),
            React.createElement('input', { className: 'field-input', type: 'email', placeholder: 'you@email.com', onChange: (e) => setEmail(e.target.value) }),
            React.createElement('label', { className: 'field-label' }, 'Password'),
            React.createElement('input', { className: 'field-input', type: 'password', placeholder: '••••••••', onChange: (e) => setPassword(e.target.value) }),
            React.createElement('button', { className: 'primary-btn' }, 'Register'),
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
              "Already have an account? ",
              React.createElement('span', { className: 'switch-link', onClick: () => setIsLogin(true) }, 'Log in')
            )
          )
    )
  )
}

export default Login