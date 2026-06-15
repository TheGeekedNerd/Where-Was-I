/**
 * Run from server/ directory:
 *   node ../inspect-powerpyx.js
 */
const axios   = require('axios')
const cheerio = require('cheerio')

const URL = 'https://www.powerpyx.com/the-last-of-us-2-walkthrough-all-chapters/'

async function main() {
  const { data } = await axios.get(URL, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  })

  const $ = cheerio.load(data)
  const content = $('.entry-content')

  if (!content.length) {
    console.log('❌ .entry-content NOT FOUND')
    console.log('Page classes found:', $('[class]').map((_, el) => $(el).attr('class')).get().slice(0, 20))
    return
  }

  console.log('✅ .entry-content found\n')
  console.log('First 50 child elements:\n')

  content.children().slice(0, 50).each((i, el) => {
    const tag  = el.tagName?.toLowerCase()
    const text = $(el).text().trim().slice(0, 80)
    const bold = $(el).find('strong, b').first().text().trim().slice(0, 80)
    console.log(`[${i}] <${tag}> text="${text}" bold="${bold}"`)
  })
}

main().catch(console.error)
