import { mkdirSync, readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { HASH, mockApi } from './mockData'

/**
 * `npm run screenshots`: the README's pictures from the production build with the mocked sample data.
 * Output: docs/screenshots/.
 */
const OUT = 'docs/screenshots'
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

test.skip(!process.env.SCREENSHOTS, 'run with npm run screenshots')
test.use({ deviceScaleFactor: 2, locale: 'en-GB' })
test.setTimeout(120_000)
test.beforeAll(() => mkdirSync(OUT, { recursive: true }))

async function open(page: Page, viewport: { width: number; height: number }, theme: string, hash = '') {
  await mockApi(page, { liveSpeeds: true })
  await page.setViewportSize(viewport)
  await page.addInitScript((t) => localStorage.setItem('qbit.theme', t), theme)
  await page.goto(`/${hash}`)
  await page.evaluate(() => document.fonts.ready)
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
  await page.mouse.move(0, 0)
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

for (const theme of ['dark', 'light']) {
  test(`desktop, ${theme}`, async ({ page }) => {
    await open(page, DESKTOP, theme)
    await page.locator(`[data-hash="${HASH}"]`).click({ position: { x: 300, y: 10 } })
    await expect(page.locator('[data-details] [data-kind="file"]').first()).toBeVisible()
    await page.waitForTimeout(16_000) // a sparkline's worth of polls
    await shot(page, `desktop-${theme}`)
  })
}

test('phone', async ({ page }) => {
  await open(page, PHONE, 'dark')
  await expect(page.locator(`[data-hash="${HASH}"]`)).toBeVisible()
  await shot(page, 'phone-list')
  await page.goto(`/#/torrent/${HASH}`)
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible()
  await page.waitForTimeout(600)
  await shot(page, 'phone-torrent')
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await shot(page, 'phone-settings')
})

/** docs/screenshots/social-preview.png: upload by hand in the repo's Settings › Social preview. */
test('social preview', async ({ page }) => {
  const b64 = (f: string) => readFileSync(f).toString('base64')
  await page.setViewportSize({ width: 1280, height: 640 })
  await page.setContent(`<!doctype html><body style="margin:0;width:1280px;height:640px;overflow:hidden;background:#09090B;color:#FAFAFA;font-family:system-ui,sans-serif;display:flex;align-items:center;gap:56px;padding-left:72px;box-sizing:border-box">
    <div style="flex:none;width:400px">
      <img src="data:image/png;base64,${b64('static/icons/icon-192.png')}" width="96" height="96" style="border-radius:22px">
      <h1 style="font-size:68px;font-weight:600;margin:24px 0 12px;letter-spacing:-0.02em">qBit</h1>
      <p style="font-size:27px;line-height:1.35;color:#D4D4D8;margin:0">A fast, modern WebUI for qBittorrent</p>
    </div>
    <img src="data:image/png;base64,${b64(`${OUT}/desktop-dark.png`)}" style="flex:none;width:1000px;border:1px solid #27272A;border-radius:14px">
  </body>`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/social-preview.png` })
})
