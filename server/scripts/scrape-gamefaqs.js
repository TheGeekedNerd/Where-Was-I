/**
 * scrape-gamefaqs.js
 *
 * Fetches chapter + subchapter structure for a game from a GameFAQs
 * Guide & Walkthrough and upserts it into MongoDB.
 *
 * Uses Playwright (Chromium) to bypass Cloudflare bot detection.
 *
 * SETUP (one time):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * USAGE:
 *   node scripts/scrape-gamefaqs.js --rawgId 58175 --title "The Last of Us Part II" --url "https://gamefaqs.gamespot.com/ps4/202466-the-last-of-us-part-ii/faqs/78416/the-story"
 *   node scripts/scrape-gamefaqs.js --rawgId 58175 --title "The Last of Us Part II" --url "..." --dry
 */

'use strict'

require('dotenv').config()
const { chromium } = require('playwright')
const cheerio      = require('cheerio')
const slugify      = require('slugify')
const mongoose     = require('mongoose')
const readline     = require('readline')

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
    source:      { type: String, default: 'gamefaqs' },
    sourceUrl:   { type: String, required: true },
    lastScraped: { type: Date,   default: Date.now },
    acts:        [actSchema],
  })
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slug(text) {
  return slugify(text, { lower: true, strict: true, trim: true })
}

function cleanTitle(raw) {
  const stripped = raw
    .replace(/^\d+\s+(?:years?|months?|days?|weeks?)\s+ago\s*[-–—]\s*/i, '')
    .trim()
  return stripped || raw.trim()
}

// ─── Fetch HTML via Playwright ─────────────────────────────────────────────────
async function fetchWithPlaywright(url) {
  console.log('  🌐 Launching browser...')

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport:  { width: 1280, height: 800 },
      locale:    'en-US',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    const page = await context.newPage()

    console.log(`  ⏳ Navigating to: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

    // Wait for chapter links to be injected by JS
    await page.waitForSelector('p strong a', { timeout: 20_000 })

    // Small extra delay to let any remaining JS settle
    await page.waitForTimeout(2_000)

    const html = await page.content()
    console.log('  ✅ Page loaded')

    // Debug: dump first 2000 chars of HTML to see what we actually got
    if (process.argv.includes('--debug')) {
      const fs = require('fs')
      fs.writeFileSync('debug-gamefaqs.html', html)
      console.log('  🐛 Full HTML dumped to debug-gamefaqs.html')
      console.log('  🐛 Preview:', html.slice(0, 500))
    }

    return html
  } finally {
    await browser.close()
  }
}

// ─── Parse HTML → acts ────────────────────────────────────────────────────────
function parseStructure(html) {
  const $ = cheerio.load(html)
  const acts = []

  let currentAct = null
  let actOrder   = 0

  // Track how many times each base slug has appeared so duplicates get a suffix
  const slugCount = {}

  $('body').find('p, ul').each((_, el) => {
    const tag = el.tagName?.toLowerCase()

    // Chapter heading: <p> containing <strong><a>
    // Links are relative on the rendered page e.g. href="jackson"
    if (tag === 'p') {
      const strong = $(el).find('strong').first()
      if (!strong.length) return

      const anchor = strong.find('a').first()
      if (!anchor.length) return

      const href = anchor.attr('href') || ''
      // Must be a relative chapter link (no # = top-level chapter page)
      if (!href || href.includes('#') || href.startsWith('http')) return

      const rawTitle = anchor.text().trim()
      if (!rawTitle) return

      // Title-case — GameFAQs index uses ALL CAPS for chapter names
      const baseTitle = rawTitle
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())

      const baseSlug = slug(baseTitle)
      slugCount[baseSlug] = (slugCount[baseSlug] || 0) + 1

      const count     = slugCount[baseSlug]
      const finalSlug = count > 1 ? `${baseSlug}-${count}` : baseSlug

      currentAct = {
        id:       finalSlug,
        title:    baseTitle,
        order:    actOrder++,
        missions: [],
      }
      acts.push(currentAct)
      return
    }

    // Subchapter list: <ul> of <li><a href="chapter#section">
    if (tag === 'ul' && currentAct) {
      $(el).find('> li').each((_, li) => {
        const a = $(li).find('a').first()
        if (!a.length) return

        const href = a.attr('href') || ''
        // Must be a relative link with an anchor fragment
        if (!href.includes('#')) return

        const rawTitle = a.text().trim()
        if (!rawTitle) return

        const title = cleanTitle(rawTitle)

        currentAct.missions.push({
          id:          `${currentAct.id}--${slug(title)}`,
          title,
          order:       currentAct.missions.length,
          description: null,
        })
      })
    }
  })

  const valid = acts.filter(a => a.missions.length > 0)
  if (valid.length === 0) {
    throw new Error(
      'No chapters with subchapters found after parsing.\n' +
      '  Make sure the URL points to the "The Story" index page of the guide,\n' +
      '  e.g. /faqs/<id>/the-story'
    )
  }

  return valid
}

// ─── DB upsert ────────────────────────────────────────────────────────────────
async function saveStructure({ rawgId, title, source, sourceUrl, acts }) {
  await GameStructure.findOneAndUpdate(
    { rawgId },
    { rawgId, title, source, sourceUrl, lastScraped: new Date(), acts },
    { upsert: true, returnDocument: 'after' }
  )
  const total = acts.reduce((s, a) => s + a.missions.length, 0)
  console.log(`  💾 Saved: ${title} (${acts.length} acts, ${total} missions)`)
}

// ─── Print ────────────────────────────────────────────────────────────────────
function printStructure(game) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${game.title}  (rawgId: ${game.rawgId})`)
  console.log(`  Source:  ${game.source}`)
  console.log(`  URL:     ${game.sourceUrl}`)
  console.log(`${'─'.repeat(60)}`)
  game.acts.forEach(act => {
    console.log(`\n  📖 ${act.title}`)
    act.missions.forEach(m => console.log(`      • ${m.title}`))
  })
  const total = game.acts.reduce((s, a) => s + a.missions.length, 0)
  console.log(`\n  Total: ${game.acts.length} acts, ${total} missions\n`)
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  const get  = key => { const i = args.indexOf(key); return i !== -1 ? args[i + 1] : undefined }
  const has  = key => args.includes(key)
  return {
    rawgId: get('--rawgId') ? Number(get('--rawgId')) : undefined,
    title:  get('--title'),
    url:    get('--url'),
    dry:    has('--dry'),
  }
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  let { rawgId, title, url, dry } = parseArgs()

  if (!rawgId) {
    const input = await prompt('RAWG ID (e.g. 58175): ')
    rawgId = Number(input)
  }
  if (!title) {
    title = await prompt('Game title (e.g. The Last of Us Part II): ')
  }
  if (!url) {
    console.log('\nProvide the GameFAQs "The Story" index URL.')
    console.log('Example: https://gamefaqs.gamespot.com/ps4/202466-the-last-of-us-part-ii/faqs/78416/the-story\n')
    url = await prompt('GameFAQs URL: ')
  }

  if (!url) {
    console.error('\n❌  A URL is required.')
    process.exit(1)
  }

  console.log(`\n🎮 Scraping: ${title}`)

  const html = await fetchWithPlaywright(url)
  const acts = parseStructure(html)
  const game = { rawgId, title, source: 'gamefaqs', sourceUrl: url, acts }

  printStructure(game)

  if (dry) {
    console.log('DRY RUN — nothing written to DB.')
    return
  }

  const confirm = await prompt('Save to MongoDB? [y/N] ')
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

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
