import { getIgdbToken } from './igdbAuth.js'

const BASE = 'https://api.igdb.com/v4'

export async function igdbQuery(endpoint, body) {
  const token = await getIgdbToken()
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IGDB ${endpoint} failed: ${res.status} ${text}`)
  }
  return res.json()
}

// Name -> ID lookup caches, built lazily on first use so we never
// hardcode IGDB's internal genre/theme IDs (which can vary/shift).
let genreMap = null
let themeMap = null

export async function getGenreId(name) {
  if (!genreMap) {
    const rows = await igdbQuery('genres', 'fields id,name; limit 50;')
    genreMap = new Map(rows.map(r => [r.name.toLowerCase(), r.id]))
  }
  return genreMap.get(name.toLowerCase()) || null
}

export async function getThemeId(name) {
  if (!themeMap) {
    const rows = await igdbQuery('themes', 'fields id,name; limit 50;')
    themeMap = new Map(rows.map(r => [r.name.toLowerCase(), r.id]))
  }
  return themeMap.get(name.toLowerCase()) || null
}