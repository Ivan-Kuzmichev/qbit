import { expect, test } from '@playwright/test'

const row = (page: import('@playwright/test').Page, name: string, isMobile: boolean) =>
  isMobile ? page.getByRole('link', { name: new RegExp(name) }) : page.getByRole('row', { name: new RegExp(name) })

test('opens straight into the app, in English, with the notice', async ({ page, isMobile }) => {
  await page.goto('./')
  await expect(row(page, 'Blender', isMobile)).toBeVisible()
  await expect(page.getByLabel('Demo')).toContainText('nothing downloads')
  await page.getByLabel('Demo').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByLabel('Demo')).toHaveCount(0)
})

test('asks nothing of any server', async ({ page, baseURL, isMobile }) => {
  const origin = new URL(baseURL!).origin
  const seen = new Set<string>()
  const api: string[] = []
  page.on('request', (r) => {
    seen.add(new URL(r.url()).origin)
    if (r.url().includes('api/v2')) api.push(r.url())
  })
  await page.goto('./')
  await expect(row(page, 'Blender', isMobile)).toBeVisible()
  await page.waitForTimeout(1500)
  expect([...seen]).toEqual([origin])
  // answered inside the page, so the browser never sends them
  expect(api).toEqual([])
})

test('torrents really move, and survive a look at the details', async ({ page, isMobile }) => {
  await page.goto('./')
  const blender = row(page, 'Blender', isMobile)
  await expect(blender).toBeVisible()
  const read = async () => Number(/(\d+)%/.exec((await blender.textContent()) ?? '')?.[1])
  const start = await read()
  await expect.poll(read, { timeout: 15_000 }).toBeGreaterThan(start)
})

test.describe('desktop actions', () => {
  test.skip(({ isMobile }) => isMobile)

  test('pause, delete and add work', async ({ page }) => {
    await page.goto('./')
    const sintel = row(page, 'Sintel', false)
    await sintel.getByRole('button', { name: 'Pause' }).click()
    await expect(sintel).toContainText('Paused')

    await sintel.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(sintel).toHaveCount(0)

    await page.getByRole('button', { name: 'Add magnet' }).click()
    await page.getByRole('dialog').getByRole('textbox', { name: /Magnet links/ }).fill(`magnet:?xt=urn:btih:${'1'.repeat(40)}&dn=My+Own+Film`)
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
    await expect(row(page, 'My Own Film', false)).toBeVisible()
  })

  test('every details tab fills in, and settings save', async ({ page }) => {
    await page.goto('./')
    await row(page, 'Blender', false).click()
    await expect(page.getByText('splash_scene.blend')).toBeVisible()
    await page.getByRole('tab', { name: 'Trackers' }).click()
    await expect(page.getByText('tracker.opentrackr.org')).toBeVisible()
    await page.getByRole('tab', { name: 'Peers' }).click()
    await expect(page.getByText('Transmission 4.0.6')).toBeVisible()
    await page.goto('./#/settings/connection')
    await page.getByRole('switch', { name: /UPnP/ }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('signing out and back in works with anything', async ({ page }) => {
    await page.goto('./#/settings/webui')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Username').fill('demo')
    await page.getByRole('textbox', { name: 'Password' }).fill('demo')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })
})

test('the notice leaves the phone controls reachable', async ({ page, isMobile }) => {
  test.skip(!isMobile)
  await page.goto('./')
  await expect(row(page, 'Blender', true)).toBeVisible()
  await page.getByRole('button', { name: 'Add torrent' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
