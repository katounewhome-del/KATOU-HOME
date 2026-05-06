// Automatically generate TikTok MP4s using a headless browser.
// Opens the dev server, clicks the one-tap button N times, captures
// each downloaded video, and saves them under generated-videos/.

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const URL = process.env.APP_URL || 'http://localhost:5180/'
const COUNT = Number(process.env.COUNT || '5')
const OUT_DIR = path.join(__dirname, '..', 'generated-videos')

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-fake-ui-for-media-stream', '--enable-features=SharedArrayBuffer', '--no-sandbox'],
  })
  const ctx = await browser.newContext({ acceptDownloads: true })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.warn('[browser error]', msg.text())
  })

  console.log(`Opening ${URL} ...`)
  await page.goto(URL, { waitUntil: 'networkidle' })

  // Wait for the one-tap button to be visible
  const oneTap = page.locator('.onetap-btn')
  await oneTap.waitFor({ state: 'visible', timeout: 15000 })

  for (let i = 0; i < COUNT; i++) {
    console.log(`\n[${i + 1}/${COUNT}] Generating...`)
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 })
    await oneTap.click()

    const download = await downloadPromise
    const suggestedName = download.suggestedFilename()
    const safeName = suggestedName.replace(/[/\\:*?"<>|]/g, '_')
    const outPath = path.join(OUT_DIR, `${String(i + 1).padStart(2, '0')}_${safeName}`)
    await download.saveAs(outPath)
    const stat = fs.statSync(outPath)
    console.log(`  saved: ${path.basename(outPath)} (${(stat.size / 1024).toFixed(1)} KB)`)

    // Wait for export state to reset before next click
    await page.waitForFunction(() => {
      const btn = document.querySelector('.onetap-btn')
      return btn && !btn.disabled
    }, { timeout: 30000 })
    await page.waitForTimeout(800)
  }

  await browser.close()
  console.log(`\nDone. ${COUNT} files in ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
