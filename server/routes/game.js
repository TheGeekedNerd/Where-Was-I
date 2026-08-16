import express from 'express'
import { igdbQuery, getGenreId, getThemeId } from '../services/igdb.js'

const router = express.Router()
const PAGE_SIZE = 20

// Client sends a short filter key; each maps to an IGDB genre or theme,
// resolved to a real ID at request time via the caches above.
const FILTERS = {
  action:       { kind: 'genre', name: 'Action' },
  rpg:          { kind: 'genre', name: 'Role-playing (RPG)' },
  adventure:    { kind: 'genre', name: 'Adventure' },
  horror:       { kind: 'theme', name: 'Horror' },
  indie:        { kind: 'genre', name: 'Indie' },
  'open-world': { kind: 'theme', name: 'Open World' },
}

function normalizeGame(g) {
  return {
    id: g.id,
    title: g.name,
    cover: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null,
    rating: g.rating ? (g.rating / 20).toFixed(1) : null, // IGDB is 0-100 -> scale to /5 like before
    released: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear().toString() : null,
    genres: (g.genres || []).map(x => x.name).slice(0, 2),
    platforms: (g.platforms || []).map(x => x.name).slice(0, 3),
    playtime: null, // IGDB has no direct equivalent to RAWG's average playtime field
    slug: g.slug,
  }
}

router.get('/search', async (req, res) => {
  try {
    const { query = '', filter = '', page = '1' } = req.query
    const pageNum = parseInt(page, 10) || 1
    const offset = (pageNum - 1) * PAGE_SIZE

    const whereClauses = ['category = 0'] // main games only, no DLC/bundles

    if (filter && FILTERS[filter]) {
      const f = FILTERS[filter]
      const id = f.kind === 'genre' ? await getGenreId(f.name) : await getThemeId(f.name)
      if (id) whereClauses.push(f.kind === 'genre' ? `genres = (${id})` : `themes = (${id})`)
    }

    const safeQuery = query.replace(/"/g, '')
    const searchClause = safeQuery ? `search "${safeQuery}";` : ''
    const sortClause = safeQuery ? '' : 'sort rating desc;'

    const body = `
      ${searchClause}
      fields name,cover.url,genres.name,platforms.name,rating,first_release_date,slug;
      where ${whereClauses.join(' & ')};
      ${sortClause}
      limit ${PAGE_SIZE};
      offset ${offset};
    `

    const results = await igdbQuery('games', body)
    res.json({
      results: results.map(normalizeGame),
      hasMore: results.length === PAGE_SIZE,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch games' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const body = `
      fields name,cover.url,genres.name,platforms.name,rating,first_release_date,summary,slug,websites.url;
      where id = ${id};
    `
    const results = await igdbQuery('games', body)
    if (!results.length) return res.status(404).json({ message: 'Game not found' })

    const g = results[0]
    res.json({
      ...normalizeGame(g),
      description: g.summary
        ? (g.summary.length > 300 ? g.summary.slice(0, 300) + '...' : g.summary)
        : 'No description available.',
      website: g.websites?.[0]?.url || null,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch game detail' })
  }
})

export default router