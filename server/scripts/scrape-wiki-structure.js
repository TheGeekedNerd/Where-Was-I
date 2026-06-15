/**
 * scrape-wiki-structure.js
 *
 * Fetches chapter/act + mission structure for a game from wiki/walkthrough sites
 * and upserts it into MongoDB — replacing manual entry in game-structures.json.
 *
 * SOURCE PRIORITY (tried in order, first success wins):
 *   1. PowerPyx  — e.g. https://www.powerpyx.com/red-dead-redemption-2-full-walkthrough/
 *   2. IGN Wiki  — e.g. https://www.ign.com/wikis/red-dead-redemption-2/Walkthrough
 *   3. Fandom    — e.g. https://reddead.fandom.com/wiki/Red_Dead_Redemption_II/Missions
 *
 * USAGE:
 *   # Scrape a single game (interactive prompt for URLs)
 *   node scripts/scrape-wiki-structure.js --rawgId 28 --title "Red Dead Redemption 2"
 *
 *   # Scrape with explicit source URLs (skip prompt)
 *   node scripts/scrape-wiki-structure.js \
 *     --rawgId 28 \
 *     --title "Red Dead Redemption 2" \
 *     --powerpyx "https://www.powerpyx.com/red-dead-redemption-2-full-walkthrough-all-story-missions/" \
 *     --ign     "https://www.ign.com/wikis/red-dead-redemption-2/Walkthrough" \
 *     --fandom  "https://reddead.fandom.com/wiki/Red_Dead_Redemption_II/Missions"
 *
 *   # Dry run — print structure, skip DB write
 *   node scripts/scrape-wiki-structure.js --rawgId 28 --title "..." --dry
 *
 *   # Scrape all games listed in scrape-targets.json
 *   node scripts/scrape-wiki-structure.js --all
 *
 * OUTPUT FORMAT (matches GameStructure schema exactly):
 *   { rawgId, title, source, sourceUrl, lastScraped, acts: [{ id, title, order, missions: [...] }] }
 */

'use strict'

require('dotenv').config()
const axios    = require('axios')
const cheerio  = require('cheerio')
const slugify  = require('slugify')
const mongoose = require('mongoose')
const readline = require('readline')
const path     = require('path')
const fs       = require('fs')

// ─── Mongoose model (mirrors models/GameStructure.js) ─────────────────────────
const missionSchema = new mongoose.Schema(
  { id: String, title: String, order: Number, description: { type: String, default: null } },
  { _id: false }
)
const actSchema = new mongoose.Schema(
  { id: String, title: String, order: Number, missions: [missionSchema] },
  { _id: false }
)
const GameStructure = mongoose.models.GameStructure || mongoose.model('GameStructure',
  new mongoose.Schema({
    rawgId:      { type: Number, required: true, unique: true },
    title:       { type: String, required: true },
    source:      { type: String, default: 'scraped' },
    sourceUrl:   { type: String, required: true },
    lastScraped: { type: Date,   default: Date.now },
    acts:        [actSchema],
  })
)

// ─── HTTP client ───────────────────────────────────────────────────────────────
const http = axios.create({
  timeout: 20_000,
  headers: {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control':   'no-cache',
  },
})

// ─── Slug helper ──────────────────────────────────────────────────────────────
function slug(text) {
  return slugify(text, { lower: true, strict: true, trim: true })
}

// ─── Shared mission builder ────────────────────────────────────────────────────
/**
 * Given an act title and an array of raw mission title strings,
 * produce the mission objects (with id, title, order).
 */
function buildMissions(actId, rawTitles) {
  return rawTitles
    .map(t => t.trim())
    .filter(Boolean)
    .map((title, order) => ({
      id:    `${actId}--${slug(title)}`,
      title,
      order,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOURCE 1 — PowerPyx
//
//  Actual page structure (confirmed via DevTools):
//    .entry-content
//      <h2>Story Missions</h2>          ← wrapper heading, skip
//      <p><strong>Chapter 1</strong></p> ← act heading (bold paragraph)
//      <ol>                             ← missions list
//        <li><a href="...">Outlaws from the West</a></li>
//        ...
//      </ol>
//      <p><strong>Chapter 2</strong></p>
//      <ol>...</ol>
//
//  Strategy: walk .entry-content children, treat <p> containing only a
//  <strong>/<b> as an act heading, treat the next <ol> as its missions.
// ─────────────────────────────────────────────────────────────────────────────
async function scrapePowerPyx(url) {
  const { data } = await http.get(url)
  const $ = cheerio.load(data)
  const acts = []

  const content = $('.entry-content')
  if (!content.length) throw new Error('PowerPyx: .entry-content not found')

  const SKIP = /trophy|table of content|guide|tips|faq|100%|checklist|compendium|outfit|clothing|map|medal|collectible/i

  let currentAct = null
  let actOrder   = 0

  content.children().each((_, el) => {
    const tag  = el.tagName?.toLowerCase()
    const text = $(el).text().trim()

    // ── Act heading detection ──────────────────────────────────────────────
    // Case A: <p> whose only meaningful content is a <strong> or <b> tag
    if (tag === 'p') {
      const bold = $(el).find('strong, b').first()
      const boldText = bold.text().trim()

      // The paragraph text and the bold text should basically match
      // (no extra text outside the bold tag means it's a pure chapter label)
      if (boldText && text === boldText && !SKIP.test(boldText)) {
        currentAct = {
          id:       slug(boldText),
          title:    boldText,
          order:    actOrder++,
          missions: [],
        }
        acts.push(currentAct)
        return
      }
    }

    // Case B: <h3> used as chapter heading on some PowerPyx game pages
    if (tag === 'h3') {
      if (!text || SKIP.test(text)) return
      currentAct = {
        id:       slug(text),
        title:    text,
        order:    actOrder++,
        missions: [],
      }
      acts.push(currentAct)
      return
    }

    // Case C: <h2> that isn't the generic "Story Missions" wrapper
    // (some PowerPyx pages use h2 directly for chapters)
    if (tag === 'h2') {
      if (!text || SKIP.test(text) || /story missions/i.test(text)) return
      currentAct = {
        id:       slug(text),
        title:    text,
        order:    actOrder++,
        missions: [],
      }
      acts.push(currentAct)
      return
    }

    if (!currentAct) return

    // ── Mission list: <ol> or <ul> of <li><a> items ────────────────────────
    if (tag === 'ol' || tag === 'ul') {
      $(el).find('> li').each((_, li) => {
        // Prefer the anchor text; fall back to full li text
        const anchor = $(li).find('a').first()
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

  const valid = acts.filter(a => a.missions.length > 0)
  if (valid.length === 0) throw new Error('PowerPyx: no acts with missions found — page structure may have changed')
  return valid
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOURCE 2 — IGN Wiki
//  Structure: Walkthrough pages have a sidebar TOC or h2/h3 heading hierarchy.
//  /wikis/<game>/Walkthrough usually lists chapters at h2, sections at h3.
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeIGN(url) {
  const { data } = await http.get(url)
  const $ = cheerio.load(data)
  const acts = []

  // IGN wiki article content
  const content = $('article, .wiki-page-content, [data-testid="wiki-content"], .content-block').first()
  const root    = content.length ? content : $('body')

  let currentAct = null
  let actOrder   = 0

  root.find('h2, h3').each((_, el) => {
    const tag  = el.tagName.toLowerCase()
    const text = $(el).text().trim()
      .replace(/\[edit\]/gi, '')
      .replace(/Edit$/i, '')
      .trim()

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

  // Fallback: if h3s are sparse, try ul > li under each h2
  if (acts.some(a => a.missions.length === 0)) {
    acts.forEach(act => {
      if (act.missions.length > 0) return
      // Find the h2 element, collect li siblings until next h2
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
  return valid
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOURCE 3 — Fandom Wiki
//  Structure: Walkthrough or /Missions pages use h2 for chapters, ul for missions.
//  Some wikis use a TOC with anchor links that map to heading IDs.
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeFandom(url) {
  const { data } = await http.get(url)
  const $ = cheerio.load(data)
  const acts = []

  // Fandom's content is in .mw-parser-output
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

  // Fallback: try TOC-based extraction if above yielded nothing
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

// ─────────────────────────────────────────────────────────────────────────────
//  ORCHESTRATOR — try sources in priority order
// ─────────────────────────────────────────────────────────────────────────────
/**
 * urls: { powerpyx?, ign?, fandom? }
 * Returns { acts, source, sourceUrl }
 */
async function fetchStructure(urls) {
  const sources = [
    { name: 'powerpyx', url: urls.powerpyx, fn: scrapePowerPyx },
    { name: 'ign',      url: urls.ign,      fn: scrapeIGN      },
    { name: 'fandom',   url: urls.fandom,   fn: scrapeFandom   },
  ].filter(s => s.url)

  if (sources.length === 0) throw new Error('No source URLs provided.')

  const errors = []

  for (const source of sources) {
    console.log(`  ⏳ Trying ${source.name}: ${source.url}`)
    try {
      const acts = await source.fn(source.url)
      console.log(`  ✅ ${source.name} succeeded — ${acts.length} acts found`)
      return { acts, source: source.name, sourceUrl: source.url }
    } catch (err) {
      console.warn(`  ⚠️  ${source.name} failed: ${err.message}`)
      errors.push(`${source.name}: ${err.message}`)
    }
  }

  throw new Error(`All sources failed:\n  ${errors.join('\n  ')}`)
}

// ─────────────────────────────────────────────────────────────────────────────
//  DB UPSERT (mirrors seed-game-structures.js)
// ─────────────────────────────────────────────────────────────────────────────
async function saveStructure({ rawgId, title, source, sourceUrl, acts }) {
  await GameStructure.findOneAndUpdate(
    { rawgId },
    { rawgId, title, source, sourceUrl, lastScraped: new Date(), acts },
    { upsert: true, new: true }
  )
  const total = acts.reduce((s, a) => s + a.missions.length, 0)
  console.log(`  💾 Saved: ${title} (${acts.length} acts, ${total} missions)`)
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args   = process.argv.slice(2)
  const get    = key => {
    const i = args.indexOf(key)
    return i !== -1 ? args[i + 1] : undefined
  }
  const has    = key => args.includes(key)
  return {
    rawgId:    get('--rawgId')    ? Number(get('--rawgId')) : undefined,
    title:     get('--title'),
    powerpyx:  get('--powerpyx'),
    ign:       get('--ign'),
    fandom:    get('--fandom'),
    dry:       has('--dry'),
    all:       has('--all'),
    noSave:    has('--no-save'),   // scrape but print JSON, don't DB write
  }
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

function printStructure(game) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${game.title}  (rawgId: ${game.rawgId})`)
  console.log(`  Source: ${game.source}`)
  console.log(`  URL:    ${game.sourceUrl}`)
  console.log(`${'─'.repeat(60)}`)
  game.acts.forEach(act => {
    console.log(`\n  📖 ${act.title}`)
    act.missions.forEach(m => console.log(`      • ${m.title}`))
  })
  const total = game.acts.reduce((s, a) => s + a.missions.length, 0)
  console.log(`\n  Total: ${game.acts.length} acts, ${total} missions\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
//  --all mode: reads scrape-targets.json
// ─────────────────────────────────────────────────────────────────────────────
async function runAll(dry) {
  const targetsPath = path.join(__dirname, 'scrape-targets.json')
  if (!fs.existsSync(targetsPath)) {
    console.error(`\n❌  scrape-targets.json not found at ${targetsPath}`)
    console.error('    Create it first — see the template at the bottom of this file.\n')
    process.exit(1)
  }
  const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'))
  console.log(`\nFound ${targets.length} targets in scrape-targets.json\n`)

  if (!dry) {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB\n')
  }

  const results = { ok: [], failed: [] }

  for (const t of targets) {
    console.log(`\n🎮 ${t.title} (rawgId: ${t.rawgId})`)
    try {
      const { acts, source, sourceUrl } = await fetchStructure({
        powerpyx: t.powerpyx,
        ign:      t.ign,
        fandom:   t.fandom,
      })
      const game = { rawgId: t.rawgId, title: t.title, source, sourceUrl, acts }
      if (dry) {
        printStructure(game)
      } else {
        await saveStructure(game)
      }
      results.ok.push(t.title)
    } catch (err) {
      console.error(`  ❌ ${t.title} — ${err.message}`)
      results.failed.push({ title: t.title, error: err.message })
    }

    // Polite delay between requests
    if (!dry) await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅  Succeeded: ${results.ok.length}`)
  results.ok.forEach(t => console.log(`    • ${t}`))
  if (results.failed.length) {
    console.log(`❌  Failed:    ${results.failed.length}`)
    results.failed.forEach(f => console.log(`    • ${f.title}: ${f.error}`))
  }

  if (!dry) await mongoose.disconnect()
}

// ─────────────────────────────────────────────────────────────────────────────
//  SINGLE GAME mode
// ─────────────────────────────────────────────────────────────────────────────
async function runSingle(opts) {
  let { rawgId, title, powerpyx, ign, fandom, dry, noSave } = opts

  // Prompt for any missing required fields
  if (!rawgId) {
    const input = await prompt('RAWG ID (e.g. 28): ')
    rawgId = Number(input)
  }
  if (!title) {
    title = await prompt('Game title (e.g. Red Dead Redemption 2): ')
  }
  if (!powerpyx && !ign && !fandom) {
    console.log('\nProvide at least one source URL (press Enter to skip any):')
    powerpyx = await prompt('  PowerPyx URL: ')  || undefined
    ign      = await prompt('  IGN Wiki URL: ')   || undefined
    fandom   = await prompt('  Fandom URL:   ')   || undefined
  }

  if (!powerpyx && !ign && !fandom) {
    console.error('\n❌  At least one URL is required.')
    process.exit(1)
  }

  console.log(`\n🎮 Scraping: ${title}`)

  const { acts, source, sourceUrl } = await fetchStructure({ powerpyx, ign, fandom })
  const game = { rawgId, title, source, sourceUrl, acts }

  printStructure(game)

  if (dry || noSave) {
    if (noSave) {
      // Emit JSON so it can be piped into game-structures.json
      const out = path.join(__dirname, `scraped-${rawgId}.json`)
      fs.writeFileSync(out, JSON.stringify(game, null, 2))
      console.log(`📄 JSON written to: ${out}`)
    }
    console.log(dry ? 'DRY RUN — nothing written to DB.' : 'No-save mode — DB skipped.')
    return
  }

  const confirm = await prompt('\nSave to MongoDB? [y/N] ')
  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborted — nothing saved.')
    return
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')
  await saveStructure(game)
  await mongoose.disconnect()
  console.log('Done. Disconnected.')
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs()
  if (opts.all) {
    await runAll(opts.dry)
  } else {
    await runSingle(opts)
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * scrape-targets.json TEMPLATE
 * Put this file at server/scripts/scrape-targets.json
 * Any field (powerpyx / ign / fandom) can be omitted — remaining are tried in order.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [
 *   {
 *     "rawgId": 28,
 *     "title": "Red Dead Redemption 2",
 *     "powerpyx": "https://www.powerpyx.com/red-dead-redemption-2-full-walkthrough-all-story-missions/",
 *     "ign":      "https://www.ign.com/wikis/red-dead-redemption-2/Walkthrough",
 *     "fandom":   "https://reddead.fandom.com/wiki/Red_Dead_Redemption_II/Missions"
 *   },
 *   {
 *     "rawgId": 3498,
 *     "title": "God of War",
 *     "powerpyx": "https://www.powerpyx.com/god-of-war-2018-full-walkthrough-all-story-missions/",
 *     "fandom":   "https://godofwar.fandom.com/wiki/God_of_War_(2018)/Walkthrough"
 *   }
 * ]
 */