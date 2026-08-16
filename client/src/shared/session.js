const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

import { isAuth0Authenticated, getAuth0User } from './auth.js'

// Syncs Google/Discord social-login users with the backend and stores the JWT.
// Returns a message string (e.g. "Account successfully created") or null.
export async function ensureBackendSession() {
    const authed = await isAuth0Authenticated()
    if (!authed) return null

    const user = await getAuth0User()
    if (!user?.sub) return null

    const isSocial = user.sub.startsWith('google-oauth2') || user.sub.includes('discord')
    if (!isSocial) return null

    try {
    const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, googleId: user.sub, username: user.name }),
    })
    const data = await res.json()
    if (data.token) localStorage.setItem('token', data.token)
    return data.message || null
    } catch {
    return null
    }
}