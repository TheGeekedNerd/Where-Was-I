/**
 * seed-game-structures.js
 *
 * Loads hardcoded game structures (game-structures.json) into MongoDB.
 * Use this instead of scrape-ign.js for games where IGN scraping fails
 * or where you'd rather use a curated, accurate structure.
 *
 * Usage:
 *   node scripts/seed-game-structures.js              ← seeds all games in the file
 *   node scripts/seed-game-structures.js --id 41494   ← seeds one game by rawgId
 *   node scripts/seed-game-structures.js --dry        ← prints what would be saved, no DB write
 */

require('dotenv').config()

const mongoose      = require('mongoose')
const structures    = require('./game-structures.json')
const GameStructure = require('../models/GameStructure')

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry')
const SINGLE  = args.includes('--id') ? Number(args[args.indexOf('--id') + 1]) : null

// ── DB upsert ─────────────────────────────────────────────────────────────────
async function saveStructure({ rawgId, title, source, sourceUrl, acts }) {
  await GameStructure.findOneAndUpdate(
    { rawgId },
    {
      rawgId,
      title,
      source:      source || 'manual',
      sourceUrl,
      lastScraped: new Date(),
      acts,
    },
    { upsert: true, returnDocument: 'after' }
  )
  const totalMissions = acts.reduce((s, a) => s + a.missions.length, 0)
  console.log(`  ✅  Saved: ${title} (${acts.length} acts, ${totalMissions} missions)`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const targets = SINGLE
    ? structures.filter(s => s.rawgId === SINGLE)
    : structures

  if (targets.length === 0) {
    console.error(`No matching structure found for rawgId ${SINGLE}`)
    process.exit(1)
  }

  if (!DRY_RUN) {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB\n')
  }

  for (const game of targets) {
    const totalMissions = game.acts.reduce((s, a) => s + a.missions.length, 0)
    console.log(`\n${game.title} (rawgId: ${game.rawgId})`)
    console.log(`  ${game.acts.length} acts, ${totalMissions} missions`)

    if (DRY_RUN) {
      game.acts.forEach(a => console.log(`    • ${a.title} (${a.missions.length} missions)`))
    } else {
      await saveStructure(game)
    }
  }

  if (!DRY_RUN) {
    await mongoose.disconnect()
    console.log('\nDone. Disconnected from MongoDB.')
  } else {
    console.log('\nDRY RUN — nothing written to DB.')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})