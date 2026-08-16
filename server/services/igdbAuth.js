let cachedToken = null
let expiresAt = 0

export async function getIgdbToken() {
  if (cachedToken && Date.now() < expiresAt) return cachedToken

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  })

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to fetch Twitch/IGDB token')
  const data = await res.json()

  cachedToken = data.access_token
  expiresAt = Date.now() + (data.expires_in - 60) * 1000 // refresh 60s early
  return cachedToken
}