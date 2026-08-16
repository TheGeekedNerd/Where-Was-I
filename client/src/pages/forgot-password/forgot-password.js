const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const emailInput = document.getElementById('email')
const messageEl = document.getElementById('message')
const submitBtn = document.getElementById('submit-btn')

function setMessage(text, isError) {
  messageEl.textContent = text || ''
  messageEl.style.color = isError ? '#e74c3c' : '#00ff89'
}

function setLoading(loading) {
  submitBtn.disabled = loading
  submitBtn.textContent = loading ? 'Sending…' : 'Send reset link'
}

async function handleSubmit() {
  const email = emailInput.value
  if (!email) return setMessage('Please enter your email', true)

  setLoading(true)
  try {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setMessage(data.message, !res.ok)
  } catch {
    setMessage('Server error', true)
  } finally {
    setLoading(false)
  }
}

submitBtn.addEventListener('click', handleSubmit)
document.getElementById('back-link').addEventListener('click', () => {
  window.location.href = '/src/pages/login/login.html'
})