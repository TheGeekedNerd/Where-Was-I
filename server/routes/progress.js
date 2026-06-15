/**
 * routes/progress.js
 *
 * Handles story progress tracking with spoiler-gating.
 *
 * Routes:
 *   GET    /progress/:rawgId            → get user's progress for a game
 *   GET    /structure/:rawgId           → get gated chapter/mission tree (scrapes wiki if not in DB)
 *   POST   /progress/:rawgId/complete   → mark a mission as done
 *   DELETE /progress/:rawgId/reset      → reset all progress for a game
 */

const express          = require('express')
const progressRouter   = express.Router()
const structureRouter  = express.Router()
const GameStructure    = require('../models/GameStructure')
const UserGameProgress = require('../models/UserGameProgress')
const Game             = require('../models/Game')
const ActivityLog      = require('../models/ActivityLog')
const axios            = require('axios')
const cheerio          = require('cheerio')
const slugify          = require('slugify')
const fs               = require('fs')
const path             = require('path')

// Load manually curated scrape targets — these always win over auto-constructed URLs
const TARGETS_PATH = path.join(__dirname, '../scripts/scrape-targets.json')
const SCRAPE_TARGETS = fs.existsSync(TARGETS_PATH)
  ? JSON.parse(fs.readFileSync(TARGETS_PATH, 'utf8'))
  : []
const TARGETS_BY_RAWGID = Object.fromEntries(SCRAPE_TARGETS.map(t => [t.rawgId, t]))

// ── Slug helper ───────────────────────────────────────────────────────────────

function slug(text) {
  return slugify(text, { lower: true, strict: true, trim: true })
}

// ── HTTP client ───────────────────────────────────────────────────────────────

const http = axios.create({
  timeout: 20_000,
  headers: {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control':   'no-cache',
  },
})

// ── URL builders ──────────────────────────────────────────────────────────────

const REMASTER_SUFFIXES = [
  /[\s\-–:]+remastered$/i,
  /[\s\-–:]+remake$/i,
  /[\s\-–:]+definitive\s+edition$/i,
  /[\s\-–:]+game\s+of\s+the\s+year\s+edition$/i,
  /[\s\-–:]+goty\s+edition$/i,
  /[\s\-–:]+complete\s+edition$/i,
  /[\s\-–:]+enhanced\s+edition$/i,
  /[\s\-–:]+royal\s+edition$/i,
  /[\s\-–:]+director['']?s\s+cut$/i,
  /[\s\-–:]+part\s+i$/i,
]

function normaliseTitle(title) {
  let t = title.trim()
  for (const re of REMASTER_SUFFIXES) {
    t = t.replace(re, '').trim()
  }
  return t
}

function buildCandidateUrls(title, rawgSlug) {
  const baseTitle = normaliseTitle(title)
  const isDifferent = baseTitle.toLowerCase() !== title.toLowerCase()

  const rawSlug      = rawgSlug || slug(title)
  const normSlug     = slug(baseTitle)

  const normSlugNumeric = normSlug
    .replace(/-part-ii$/, '-2')
    .replace(/-part-iii$/, '-3')
    .replace(/-part-iv$/, '-4')
  const powerpyxUrls = [
    `https://www.powerpyx.com/${rawSlug}-walkthrough/`,
    isDifferent ? `https://www.powerpyx.com/${normSlug}-walkthrough/` : null,
    isDifferent ? `https://www.powerpyx.com/${normSlugNumeric}-walkthrough/` : null,
    isDifferent ? `https://www.powerpyx.com/${normSlug}-full-walkthrough/` : null,
    isDifferent ? `https://www.powerpyx.com/${normSlugNumeric}-full-walkthrough/` : null,
    `https://www.powerpyx.com/${rawSlug}-full-walkthrough/`,
    `https://www.powerpyx.com/${rawSlug}-full-walkthrough-all-story-missions/`,
    isDifferent ? `https://www.powerpyx.com/${normSlugNumeric}-full-walkthrough-all-story-missions/` : null,
  ].filter(Boolean)

  const ignUrls = [
    `https://www.ign.com/wikis/${rawSlug}/Walkthrough`,
    isDifferent ? `https://www.ign.com/wikis/${normSlug}/Walkthrough` : null,
  ].filter(Boolean)

  const fandomSub      = slug(baseTitle.split(':')[0].trim()).replace(/-/g, '')
  const fandomPathFull = slug(title).replace(/-/g, '_')
  const fandomPathNorm = slug(baseTitle).replace(/-/g, '_')
  const fandomUrls = [
    `https://${fandomSub}.fandom.com/wiki/${fandomPathFull}/Walkthrough`,
    isDifferent ? `https://${fandomSub}.fandom.com/wiki/${fandomPathNorm}/Walkthrough` : null,
    `https://${fandomSub}.fandom.com/wiki/Walkthrough`,
    `https://${fandomSub}.fandom.com/wiki/${fandomPathNorm.replace(/_part_ii.*/, '')}_part_ii/Walkthrough`,
  ].filter(Boolean)

  return { powerpyxUrls, ignUrls, fandomUrls }
}

// ── Scrapers ──────────────────────────────────────────────────────────────────

const SKIP = /trophy|table of content|guide|tips|faq|100%|checklist|compendium|outfit|clothing|map|medal|collectible/i

async function scrapePowerPyx(url) {
  const { data } = await http.get(url)
  const $ = cheerio.load(data)
  const acts = []

  const content = $('.entry-content')
  if (!content.length) throw new Error('PowerPyx: .entry-content not found')

  let currentAct = null
  let actOrder   = 0

  content.children().each((_, el) => {
    const tag  = el.tagName?.toLowerCase()
    const text = $(el).text().trim()

    if (tag === 'p') {
      const bold     = $(el).find('strong, b').first()
      const boldText = bold.text().trim()
      if (boldText && text === boldText && !SKIP.test(boldText)) {
        currentAct = { id: slug(boldText), title: boldText, order: actOrder++, missions: [] }
        acts.push(currentAct)
        return
      }
    }

    if (tag === 'h3') {
      if (!text || SKIP.test(text)) return
      currentAct = { id: slug(text), title: text, order: actOrder++, missions: [] }
      acts.push(currentAct)
      return
    }

    if (tag === 'h2') {
      if (!text || SKIP.test(text) || /story missions/i.test(text)) return
      currentAct = { id: slug(text), title: text, order: actOrder++, missions: [] }
      acts.push(currentAct)
      return
    }

    if (!currentAct) return

    if (tag === 'ol' || tag === 'ul') {
      $(el).find('> li').each((_, li) => {
        const anchor       = $(li).find('a').first()
        const missionTitle = (anchor.length ? anchor.text() : $(li).text()).trim()
        if (!missionTitle || SKIP.test(missionTitle)) return
        currentAct.missions.push({
          id:    `${currentAct.id}--${slug(missionTitle)}`,
          title: missionTitle,
          order: currentAct.missions.length,
        })
      })
    }
  })

  let valid = acts.filter(a => a.missions.length > 0)

  if (valid.length === 0) {
    actOrder = 0
    content.find('ol, ul').each((_, list) => {
      const firstBold = $(list).find('li').first().find('strong, b').first().text().trim()
      if (!firstBold) return

      $(list).find('> li').each((_, li) => {
        const bold      = $(li).find('strong, b').first()
        const boldText  = bold.text().trim()
        const liText    = $(li).text().trim()

        if (boldText && liText.replace(/\s[\s\S]*/, '') === boldText && !SKIP.test(boldText)) {
          currentAct = { id: slug(boldText), title: boldText, order: actOrder++, missions: [] }
          acts.push(currentAct)
          $(li).find('li').each((_, subli) => {
            const anchor = $(subli).find('a').first()
            const t = (anchor.length ? anchor.text() : $(subli).text()).trim()
            if (t && !SKIP.test(t)) {
              currentAct.missions.push({
                id:    `${currentAct.id}--${slug(t)}`,
                title: t,
                order: currentAct.missions.length,
              })
            }
          })
          return
        }

        if (currentAct) {
          const anchor = $(li).find('a').first()
          const t = (anchor.length ? anchor.text() : liText).trim()
          if (t && !SKIP.test(t)) {
            currentAct.missions.push({
              id:    `${currentAct.id}--${slug(t)}`,
              title: t,
              order: currentAct.missions.length,
            })
          }
        }
      })
    })
    valid = acts.filter(a => a.missions.length > 0)
  }

  if (valid.length === 0) throw new Error('PowerPyx: no acts with missions found')

  const totalMissions = valid.reduce((s, a) => s + a.missions.length, 0)
  if (totalMissions < 5) {
    throw new Error(`PowerPyx: result too sparse (${totalMissions} missions) — likely site chrome`)
  }

  return valid
}

async function scrapeIGN(url) {
  const { data } = await http.get(url)
  const $ = cheerio.load(data)
  const acts = []

  const content = $('article, .wiki-page-content, [data-testid="wiki-content"], .content-block').first()
  const root    = content.length ? content : $('body')

  let currentAct = null
  let actOrder   = 0

  root.find('h2, h3').each((_, el) => {
    const tag  = el.tagName.toLowerCase()
    const text = $(el).text().trim().replace(/\[edit\]/gi, '').replace(/Edit$/i, '').trim()

    if (!text || /table of content|overview|introduction|tips|controls/i.test(text)) return

    if (tag === 'h2') {
      currentAct = { id: slug(text), title: text, order: actOrder++, missions: [] }
      acts.push(currentAct)
    } else if (tag === 'h3' && currentAct) {
      currentAct.missions.push({
        id:    `${currentAct.id}--${slug(text)}`,
        title: text,
        order: currentAct.missions.length,
      })
    }
  })

  if (acts.some(a => a.missions.length === 0)) {
    acts.forEach(act => {
      if (act.missions.length > 0) return
      root.find('h2').filter((_, el) => $(el).text().trim().includes(act.title)).each((_, h2) => {
        let sibling = $(h2).next()
        while (sibling.length && sibling[0].tagName?.toLowerCase() !== 'h2') {
          if (sibling[0].tagName?.toLowerCase() === 'ul') {
            sibling.find('li').each((_, li) => {
              const t = $(li).text().trim()
              if (t) act.missions.push({ id: `${act.id}--${slug(t)}`, title: t, order: act.missions.length })
            })
          }
          sibling = sibling.next()
        }
      })
    })
  }

  const valid = acts.filter(a => a.missions.length > 0)
  if (valid.length === 0) throw new Error('IGN: no acts with missions found')

  const totalMissions = valid.reduce((s, a) => s + a.missions.length, 0)
  if (valid.length < 2 || totalMissions < 5) {
    throw new Error(`IGN: result too sparse (${valid.length} acts, ${totalMissions} missions) — likely site chrome`)
  }

  return valid
}

async function scrapeFandom(url) {
  const { data } = await http.get(url)
  const $ = cheerio.load(data)
  const acts = []

  const content = $('.mw-parser-output')
  if (!content.length) throw new Error('Fandom: .mw-parser-output not found')

  let currentAct = null
  let actOrder   = 0

  content.children().each((_, el) => {
    const tag  = el.tagName?.toLowerCase()
    const text = $(el).text().trim().replace(/\[edit\]|\[Edit\]/g, '').trim()

    if (!text) return

    if (tag === 'h2') {
      if (/see also|references|notes|external|navbox|trivia/i.test(text)) return
      currentAct = { id: slug(text), title: text, order: actOrder++, missions: [] }
      acts.push(currentAct)
      return
    }

    if (!currentAct) return

    if (tag === 'h3') {
      if (/see also|references/i.test(text)) return
      currentAct.missions.push({
        id:    `${currentAct.id}--${slug(text)}`,
        title: text,
        order: currentAct.missions.length,
      })
      return
    }

    if (tag === 'ul') {
      $(el).find('li').each((_, li) => {
        const missionTitle = $(li).clone().find('ul').remove().end().text().trim()
        if (missionTitle) {
          currentAct.missions.push({
            id:    `${currentAct.id}--${slug(missionTitle)}`,
            title: missionTitle,
            order: currentAct.missions.length,
          })
        }
      })
    }
  })

  if (acts.every(a => a.missions.length === 0)) {
    const tocLinks = $('.toc li a, #toc li a')
    if (tocLinks.length) {
      acts.length = 0
      actOrder    = 0
      currentAct  = null
      tocLinks.each((_, a) => {
        const level = $(a).closest('li').parents('li').length
        const text  = $(a).text().trim().replace(/^\d[\d.]*\s*/, '')
        if (!text) return
        if (level === 0) {
          currentAct = { id: slug(text), title: text, order: actOrder++, missions: [] }
          acts.push(currentAct)
        } else if (level === 1 && currentAct) {
          currentAct.missions.push({
            id:    `${currentAct.id}--${slug(text)}`,
            title: text,
            order: currentAct.missions.length,
          })
        }
      })
    }
  }

  const valid = acts.filter(a => a.missions.length > 0)
  if (valid.length === 0) throw new Error('Fandom: no acts with missions found')
  return valid
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

async function fetchStructure(urls) {
  const sources = [
    { name: 'powerpyx', urls: urls.powerpyxUrls || (urls.powerpyx ? [urls.powerpyx] : []), fn: scrapePowerPyx },
    { name: 'ign',      urls: urls.ignUrls      || (urls.ign      ? [urls.ign]      : []), fn: scrapeIGN      },
    { name: 'fandom',   urls: urls.fandomUrls   || (urls.fandom   ? [urls.fandom]   : []), fn: scrapeFandom   },
  ].filter(s => s.urls.length > 0)

  if (sources.length === 0) throw new Error('No source URLs provided')

  const errors = []
  for (const source of sources) {
    for (const url of source.urls) {
      try {
        const acts = await source.fn(url)
        console.log(`[structure] ${source.name} succeeded: ${url}`)
        return { acts, source: source.name, sourceUrl: url }
      } catch (err) {
        console.log(`[structure] ${source.name} failed (${url}): ${err.message}`)
        errors.push(`${source.name}(${url}): ${err.message}`)
      }
    }
  }
  throw new Error(`All sources failed: ${errors.join(' | ')}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveCurrent(allMissionIds, completedSet) {
  if (allMissionIds.length === 0) return null
  const next = allMissionIds.find(id => !completedSet.has(id))
  return next || null
}

function buildGatedStructure(acts, completedSet, currentMissionId) {
  let pastCurrent = false

  return acts.map(act => {
    const gatedMissions = act.missions.map(mission => {
      if (pastCurrent) {
        return { id: null, title: null, order: mission.order, locked: true }
      }
      if (mission.id === currentMissionId) {
        pastCurrent = true
        return { ...mission, current: true, locked: false }
      }
      if (completedSet.has(mission.id)) {
        return { ...mission, completed: true, locked: false }
      }
      return { ...mission, locked: false }
    })

    const allLocked = gatedMissions.every(m => m.locked)
    return {
      id:       allLocked ? null : act.id,
      title:    allLocked ? null : act.title,
      order:    act.order,
      locked:   allLocked,
      missions: gatedMissions,
    }
  })
}

// ── GET /structure/:rawgId ────────────────────────────────────────────────────

structureRouter.get('/:rawgId', async (req, res) => {
  const rawgId = Number(req.params.rawgId)

  try {
    let structure = await GameStructure.findOne({ rawgId }).lean()

    if (!structure) {
      const game = await Game.findOne({ rawgId }).lean()
      if (!game) {
        return res.status(404).json({
          status:  'unavailable',
          message: 'Game not found in library',
        })
      }

      console.log(`[structure] No DB entry for "${game.title}" — attempting wiki scrape`)
      const target = TARGETS_BY_RAWGID[rawgId]
      const urls   = target
        ? {
            ...(() => {
              const auto = buildCandidateUrls(game.title, game.slug)
              return {
                powerpyxUrls: [...(target.powerpyx ? [target.powerpyx] : []), ...auto.powerpyxUrls.filter(u => u !== target.powerpyx)],
                ignUrls:      [...(target.ign      ? [target.ign]      : []), ...auto.ignUrls.filter(u => u !== target.ign)],
                fandomUrls:   [...(target.fandom   ? [target.fandom]   : []), ...auto.fandomUrls.filter(u => u !== target.fandom)],
              }
            })(),
          }
        : buildCandidateUrls(game.title, game.slug)
      if (target) console.log(`[structure] Using curated URLs for rawgId ${rawgId}`)

      let scrapeResult
      try {
        scrapeResult = await fetchStructure(urls)
      } catch (scrapeErr) {
        console.warn(`[structure] Scrape failed for rawgId ${rawgId}: ${scrapeErr.message}`)
        return res.status(404).json({
          status:  'unavailable',
          message: 'No story structure found — wiki pages could not be parsed for this game',
        })
      }

      await GameStructure.findOneAndUpdate(
        { rawgId },
        {
          rawgId,
          title:       game.title,
          source:      scrapeResult.source,
          sourceUrl:   scrapeResult.sourceUrl,
          lastScraped: new Date(),
          acts:        scrapeResult.acts,
        },
        { upsert: true, new: true }
      )

      structure = await GameStructure.findOne({ rawgId }).lean()
      console.log(`[structure] Saved "${game.title}" — ${structure.acts.length} acts`)
    }

    const progress = await UserGameProgress.findOne({ userId: req.userId, rawgId })

    const completedSet     = new Set(progress?.completedMissions || [])
    const allMissionIds    = structure.acts.flatMap(a => a.missions.map(m => m.id))
    const currentMissionId = progress?.currentMissionId || resolveCurrent(allMissionIds, completedSet)

    const gatedActs = buildGatedStructure(structure.acts, completedSet, currentMissionId)

    res.json({
      rawgId,
      title:          structure.title,
      currentMissionId,
      totalMissions:  allMissionIds.length,
      completedCount: completedSet.size,
      acts:           gatedActs,
    })

  } catch (err) {
    console.error('[structure] Server error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ── GET /progress/:rawgId ─────────────────────────────────────────────────────

progressRouter.get('/:rawgId', async (req, res) => {
  const rawgId = Number(req.params.rawgId)

  try {
    const progress = await UserGameProgress.findOne({ userId: req.userId, rawgId })

    if (!progress) {
      return res.json({
        rawgId,
        completedMissions: [],
        currentMissionId:  null,
        started:           false,
      })
    }

    res.json({
      rawgId,
      completedMissions: progress.completedMissions,
      currentMissionId:  progress.currentMissionId,
      started:           true,
      updatedAt:         progress.updatedAt,
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ── POST /progress/:rawgId/complete ──────────────────────────────────────────

progressRouter.post('/:rawgId/complete', async (req, res) => {
  const rawgId        = Number(req.params.rawgId)
  const { missionId } = req.body

  if (!missionId) return res.status(400).json({ message: 'missionId is required' })

  try {
    const structure = await GameStructure.findOne({ rawgId })
    if (!structure) return res.status(404).json({ message: 'No story structure available for this game' })

    const allMissionIds = structure.acts.flatMap(a => a.missions.map(m => m.id))
    if (!allMissionIds.includes(missionId))
      return res.status(400).json({ message: 'Invalid missionId for this game' })

    let progress = await UserGameProgress.findOne({ userId: req.userId, rawgId })
    if (!progress) {
      progress = new UserGameProgress({
        userId: req.userId, rawgId,
        completedMissions: [], currentMissionId: null,
      })
    }

    const completedSet = new Set(progress.completedMissions)
    if (!completedSet.has(missionId)) {
      completedSet.add(missionId)
      progress.completedMissions = Array.from(completedSet)
    }

    progress.currentMissionId = resolveCurrent(allMissionIds, completedSet)
    await progress.save()

    // ── Activity log ─────────────────────────────────────────────────────────
    let missionTitle = missionId
    for (const act of structure.acts) {
      const found = act.missions.find(m => m.id === missionId)
      if (found) { missionTitle = found.title; break }
    }

    const game = await Game.findOne({ userId: req.userId, rawgId }).lean()

    await ActivityLog.create({
      userId:    req.userId,
      rawgId,
      gameTitle: structure.title,
      cover:     game?.cover || null,
      eventType: 'mission_completed',
      label:     `Completed "${missionTitle}" in ${structure.title}`,
    })

    res.json({
      completedMissions: progress.completedMissions,
      currentMissionId:  progress.currentMissionId,
      completedCount:    completedSet.size,
      totalMissions:     allMissionIds.length,
      finished:          progress.currentMissionId === null,
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ── DELETE /progress/:rawgId/reset ───────────────────────────────────────────

progressRouter.delete('/:rawgId/reset', async (req, res) => {
  const rawgId = Number(req.params.rawgId)

  try {
    await UserGameProgress.findOneAndDelete({ userId: req.userId, rawgId })
    res.json({ message: 'Progress reset', rawgId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = { progressRouter, structureRouter }