import { API_URL } from '../../shared/config.js'

// Token comes from ?token=... instead of a route param
const token = new URLSearchParams(window.location.search).get('token')

const passwordInput = document.getElementById('password')
const confirmInput = document.getElementById('confirm')
const messageEl = document.getElementById('message')
const resetBtn = document.getElementById('reset-btn')

function setMessage(text, isError) {
  messageEl.textContent = text || ''
  messageEl.style.color = isError ? '#e74c3c' : '#00ff89'
}

function setLoading(loading) {
  resetBtn.disabled = loading
  resetBtn.textContent = loading ? 'Resetting…' : 'Reset password'
}

async function handleReset() {
  const password = passwordInput.value
  const confirm = confirmInput.value

  if (!token) return setMessage('Missing or invalid reset link', true)
  if (!password || !confirm) return setMessage('Please fill in all fields', true)
  if (password !== confirm) return setMessage('Passwords do not match', true)

  setLoading(true)
  try {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    setMessage(data.message, !res.ok)
    if (res.ok) {
      setTimeout(() => {
        window.location.href = '/src/pages/login/login.html'
      }, 2000)
    }
  } catch {
    setMessage('Server error', true)
  } finally {
    setLoading(false)
  }
}

resetBtn.addEventListener('click', handleReset)
document.getElementById('back-link').addEventListener('click', () => {
  window.location.href = '/src/pages/login/login.html'
})