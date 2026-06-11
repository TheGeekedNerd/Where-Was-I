/**
 * scrape-ign.js
 *
 * Scrapes IGN walkthrough pages and saves chapter/mission structure
 * to the GameStructure collection.
 *
 * Usage:
 *   node scripts/scrape-ign.js              ← scrapes all games in sources.json
 *   node scripts/scrape-ign.js --id 28      ← scrapes one game by rawgId
 *   node scripts/scrape-ign.js --dry        ← prints parsed structure, no DB write
 *
 * Requirements:
 *   npm install puppeteer mongoose dotenv slugify
 */

require('dotenv').config({ path: '../.env' })

const puppeteer    = require('puppeteer')
const mongoose     = require('mongoose')
const slugify      = require('slugify')
const sources      = require('./sources.json')
const GameStructure = require('../models/GameStructure')

// ── CLI flags ────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry')
const SINGLE  = args.includes('--id') ? Number(args[args.indexOf('--id') + 1]) : null

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Slugify a title into a stable id string.
 * e.g. "Chapter 1 – Outlaws from the West" → "chapter-1-outlaws-from-the-west"
 */
function makeId(text) {
  return slugify(text, { lower: true, strict: true })
}

/**
 * Strip leading/trailing whitespace and collapse internal whitespace.
 */
function clean(str) {
  return str.replace(/\s+/g, ' ').trim()
}

/**
 * Returns true if a string looks like a chapter/act heading.
 * IGN headings are usually h2 or h3 elements inside the walkthrough content.
 * Common patterns: "Chapter 1", "Act I", "Part 1", "Prologue", "Epilogue"
 */
function isChapterHeading(text) {
  return /^(chapter|act|part|prologue|epilogue|section|chapter \d)/i.test(text)
}

// ── Core scraper ─────────────────────────────────────────────────────────────

/**
 * Scrapes a single IGN walkthrough page and returns a structured acts array.
 *
 * IGN walkthrough pages render their content client-side, so we use Puppeteer
 * to wait for the content to appear before parsing.
 *
 * The strategy:
 *  1. Navigate to the walkthrough page
 *  2. Wait for the wiki content container to appear
 *  3. Grab all h2/h3 headings (acts/chapters) and the list items (missions)
 *     that follow each heading until the next heading
 *  4. Clean and structure the data
 */
async function scrapeWalkthrough(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

  // Wait for IGN's wiki article body to render
  await page.waitForSelector('[class*="article-body"], [class*="wiki-content"], .content-block', {
    timeout: 30000,
  }).catch(() => {
    console.warn('  ⚠  Content selector timed out — attempting parse anyway')
  })

  // Give JS-rendered content a moment to settle
  await new Promise(r => setTimeout(r, 2000))

  const acts = await page.evaluate(() => {
    const acts = []
    let currentAct = null
    let actOrder = 0
    let missionOrder = 0

    // IGN wiki content lives inside an article body; grab all relevant elements
    // We walk the DOM looking for heading elements and list items
    const container =
      document.querySelector('[class*="article-body"]') ||
      document.querySelector('[class*="wiki-content"]')  ||
      document.querySelector('article') ||
      document.body

    const nodes = container.querySelectorAll('h2, h3, h4, li, p')

    const chapterPattern = /^(chapter|act|part|prologue|epilogue|section)/i

    nodes.forEach(node => {
      const tag  = node.tagName.toLowerCase()
      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()

      if (!text || text.length < 3) return

      // Heading → start a new act
      if ((tag === 'h2' || tag === 'h3') && chapterPattern.test(text)) {
        currentAct = {
          id:       '',         // filled below after returning to Node context
          title:    text,
          order:    actOrder++,
          missions: [],
        }
        missionOrder = 0
        acts.push(currentAct)
        return
      }

      // List item under a current act → treat as a mission
      // Filter out nav items, external links, and very short strings
      if (tag === 'li' && currentAct && text.length > 4 && text.length < 120) {
        // Skip items that look like navigation or meta content
        const skip = /^(back to top|see also|contents|navigation|edit|view|more|next|previous)/i
        if (skip.test(text)) return

        currentAct.missions.push({
          id:    '',           // filled below
          title: text,
          order: missionOrder++,
        })
      }
    })

    return acts
  })

  // Generate stable IDs back in Node context using slugify
  return acts
    .filter(act => act.missions.length > 0)   // drop headings with no missions
    .map(act => ({
      ...act,
      id:       makeId(act.title),
      missions: act.missions.map(m => ({
        ...m,
        id: `${makeId(act.title)}--${makeId(m.title)}`,
      }))
    }))
}

// ── DB upsert ─────────────────────────────────────────────────────────────────

async function saveStructure({ rawgId, title, ign_url }, acts) {
  await GameStructure.findOneAndUpdate(
    { rawgId },
    {
      rawgId,
      title,
      source:      'ign',
      sourceUrl:   ign_url,
      lastScraped: new Date(),
      acts,
    },
    { upsert: true, new: true }
  )
  console.log(`  ✅  Saved: ${title} (${acts.length} acts, ${acts.reduce((s, a) => s + a.missions.length, 0)} missions)`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targets = SINGLE
    ? sources.filter(s => s.rawgId === SINGLE)
    : sources

  if (targets.length === 0) {
    console.error(`No matching source found for rawgId ${SINGLE}`)
    process.exit(1)
  }

  if (!DRY_RUN) {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB\n')
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  // Set a realistic user-agent so IGN doesn't block the request
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  for (const source of targets) {
    console.log(`\nScraping: ${source.title}`)
    console.log(`  URL: ${source.ign_url}`)

    try {
      const acts = await scrapeWalkthrough(page, source.ign_url)

      if (acts.length === 0) {
        console.warn(`  ⚠  No acts parsed — page structure may have changed`)
        continue
      }

      console.log(`  Parsed ${acts.length} acts:`)
      acts.forEach(a => console.log(`    • ${a.title} (${a.missions.length} missions)`))

      if (DRY_RUN) {
        console.log('\n  DRY RUN — full structure:')
        console.log(JSON.stringify(acts, null, 2))
      } else {
        await saveStructure(source, acts)
      }

    } catch (err) {
      console.error(`  ❌  Failed to scrape ${source.title}: ${err.message}`)
    }

    // Polite delay between requests so we don't hammer IGN
    if (targets.indexOf(source) < targets.length - 1) {
      console.log('  Waiting 3s before next request...')
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  await browser.close()

  if (!DRY_RUN) {
    await mongoose.disconnect()
    console.log('\nDone. Disconnected from MongoDB.')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
