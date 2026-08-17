import { redirectIfLoggedIn } from '../../shared/auth-guard.js'
import { loginWithConnection } from '../../shared/auth.js'
import { API_URL } from '../../shared/config.js'

await redirectIfLoggedIn()


const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const messageEl = document.getElementById('message')

function setMessage(text) {
    messageEl.textContent = text || ''
}

async function handleLogin() {
    const email = emailInput.value
    const password = passwordInput.value
    if (!email || !password) return setMessage('Please fill in all fields')

    try {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (res.ok) {
        localStorage.setItem('token', data.token)
        window.location.href = '/src/pages/dashboard/dashboard.html'
    } else {
        setMessage(data.message)
    }
    } catch {
    setMessage('Server error')
    }
}

document.getElementById('login-btn').addEventListener('click', handleLogin)
document.getElementById('forgot-link').addEventListener('click', () => {
    window.location.href = '/src/pages/forgot-password/forgot-password.html'
})
document.getElementById('register-link').addEventListener('click', () => {
    window.location.href = '/src/pages/register/register.html'
})
document.getElementById('google-btn').addEventListener('click', () => {
    loginWithConnection('google-oauth2')
})
document.getElementById('discord-btn').addEventListener('click', () => {
    loginWithConnection('discord')
})