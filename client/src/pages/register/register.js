import { redirectIfLoggedIn } from '../../shared/auth-guard.js'
import { loginWithConnection } from '../../shared/auth.js'

await redirectIfLoggedIn()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const usernameInput = document.getElementById('username')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const messageEl = document.getElementById('message')

// Equivalent of location.state?.message — a page (e.g. reset-password)
// can set sessionStorage.setItem('registerMessage', '...') before redirecting here
const carriedMessage = sessionStorage.getItem('registerMessage')
if (carriedMessage) {
  messageEl.textContent = carriedMessage
  sessionStorage.removeItem('registerMessage')
}

function setMessage(text) {
  messageEl.textContent = text || ''
}

async function handleRegister() {
  const username = usernameInput.value
  const email = emailInput.value
  const password = passwordInput.value
  if (!username || !email || !password) return setMessage('Please fill in all fields')

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    const data = await res.json()
    setMessage(data.message)

    if (res.status === 201) {
      setTimeout(() => {
        window.location.href = '/src/pages/dashboard/dashboard.html'
      }, 2000)
    }
  } catch {
    setMessage('Server error')
  }
}

document.getElementById('register-btn').addEventListener('click', handleRegister)
document.getElementById('login-link').addEventListener('click', () => {
  window.location.href = '/src/pages/login/login.html'
})
document.getElementById('google-btn').addEventListener('click', () => {
  loginWithConnection('google-oauth2')
})
document.getElementById('discord-btn').addEventListener('click', () => {
  loginWithConnection('discord')
})