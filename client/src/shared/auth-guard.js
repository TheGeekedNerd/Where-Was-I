import { isLoggedIn, logout } from './auth.js'

const INACTIVITY_LIMIT = 15 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
const STORAGE_KEY = 'wwi_last_activity'

function updateActivity() {
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
}

function startInactivityWatcher() {
    updateActivity()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, updateActivity))

    const checkInactivity = () => {
    const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
    if (Date.now() - last > INACTIVITY_LIMIT) logout()
    }

    document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkInactivity()
    })

  setInterval(checkInactivity, 30 * 1000)
}

// Call at the top of every PROTECTED page (dashboard, overview, my-games, etc.)
export async function requireAuth() {
    const loggedIn = await isLoggedIn()
    if (!loggedIn) {
    window.location.replace('/src/pages/login/login.html')
    return false
    }
    startInactivityWatcher()
    return true
}

// Call at the top of every PUBLIC-ONLY page (login, register, forgot/reset password)
export async function redirectIfLoggedIn() {
    const loggedIn = await isLoggedIn()
    if (loggedIn) {
    window.location.replace('/src/pages/dashboard/dashboard.html')
    return true
    }
    return false
}