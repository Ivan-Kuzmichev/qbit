import type { Page } from '@playwright/test'
import { expect, MULTI_TORRENT, test, TINY_NAME, type Qb } from './fixtures'

/** Opens the app already signed in with the fixture's session: no login form, so no login attempt is spent. */
async function openSignedIn(page: Page, qb: Qb, hash = '') {
  await page.context().addCookies(await qb.cookies())
  await page.goto(`/${hash}`)
}

const searchBox = (page: Page) => page.getByRole('textbox', { name: 'Поиск торрентов' })

test.describe('acceptance: network', () => {
  test('every screen talks to its own origin only', async ({ page, baseURL, isMobile, qb }) => {
    const origins = new Set<string>()
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin)
    })
    await qb.addTorrent()

    // the login screen first, as a signed-out visitor
    await page.goto('/')
    await expect(page.getByRole('form', { name: 'Вход' })).toBeVisible()

    await openSignedIn(page, qb)
    await expect(searchBox(page)).toBeVisible()

    if (isMobile) {
      await page.getByRole('link', { name: new RegExp(TINY_NAME) }).click()
      for (const tab of ['Файлы', 'Трекеры', 'Пиры', 'Сведения']) {
        await page.getByRole('tab', { name: tab }).click()
        await page.waitForLoadState('networkidle')
      }
    } else {
      await page.getByRole('row', { name: new RegExp(TINY_NAME) }).click()
      for (const tab of ['Файлы', 'Трекеры', 'Пиры', 'Сведения']) {
        await page.getByRole('tab', { name: tab }).click()
        await page.waitForLoadState('networkidle')
      }
      await page.getByRole('button', { name: 'Добавить magnet' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: /Скорость и лимиты/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await page.evaluate(() => {
      location.hash = '#/settings'
    })
    await expect(page.getByRole('heading', { name: /Настройки/ }).first()).toBeVisible()
    await page.waitForLoadState('networkidle')

    expect([...origins]).toEqual([new URL(baseURL!).origin])
  })
})

test.describe('acceptance: lost connection', () => {
  test('shows the banner, retries, and goes away on recovery without the login screen', async ({ page, qb }) => {
    await qb.addTorrent()
    await openSignedIn(page, qb)
    await expect(searchBox(page)).toBeVisible()

    // the server "disappears": requests fail at the network level, which never reaches the server
    await page.route('**/api/v2/**', (route) => route.abort('connectionrefused'))
    const banner = page.getByRole('status').filter({ hasText: 'Нет соединения, повторяем…' })
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('form', { name: 'Вход' })).toHaveCount(0)
    // the screen stays in place under the banner
    await expect(searchBox(page)).toBeVisible()

    await page.unroute('**/api/v2/**')
    await expect(banner).toBeHidden({ timeout: 10_000 })
    await expect(page.getByRole('form', { name: 'Вход' })).toHaveCount(0)
    await expect(searchBox(page)).toBeVisible()
  })

  test('at startup: the retry card shows, then the app opens once the server answers', async ({ page, qb }) => {
    await page.context().addCookies(await qb.cookies())
    await page.route('**/api/v2/**', (route) => route.abort('connectionrefused'))
    await page.goto('/')
    await expect(page.getByRole('status').filter({ hasText: 'Нет соединения, повторяем…' })).toBeVisible()
    await expect(page.getByRole('form', { name: 'Вход' })).toHaveCount(0)

    await page.unroute('**/api/v2/**')
    await expect(searchBox(page)).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('acceptance: keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'a hardware keyboard is a desktop case')

  test('arrows select, / searches, Delete asks, Escape closes and focus comes back to the row', async ({ page, qb }) => {
    await qb.addTorrent()
    await qb.addTorrent(MULTI_TORRENT)
    await openSignedIn(page, qb)
    const rows = page.getByRole('grid').getByRole('row')
    await expect(rows).toHaveCount(3, { timeout: 10_000 })

    await page.keyboard.press('ArrowDown')
    const selected = page.locator('[role="row"][aria-selected="true"]')
    await expect(selected).toHaveCount(1)
    await expect(selected).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(selected).toBeFocused()
    // Enter moves focus into the details card of the selected torrent
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Детали торрента' })).toBeFocused()

    await page.getByRole('grid').getByRole('row').nth(1).click()
    await page.keyboard.press('Delete')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // while a dialog is open the arrows do nothing to the list
    await page.keyboard.press('ArrowDown')
    await expect(selected).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(selected).toBeFocused()

    await page.keyboard.press('/')
    await expect(searchBox(page)).toBeFocused()
    await page.keyboard.type('qbit-e2e-tiny')
    await expect(rows).toHaveCount(2)
    await searchBox(page).fill('нет такого')
    await expect(page.getByText('Ничего не найдено')).toBeVisible()
  })
})

test.describe('acceptance: focus ring', () => {
  test('a framed field shows one ring, on its frame', async ({ page, qb }) => {
    await openSignedIn(page, qb)
    const input = searchBox(page)
    await input.click()
    await expect(input).toHaveCSS('box-shadow', 'none')
    await expect(input.locator('xpath=..')).not.toHaveCSS('box-shadow', 'none')
  })
})
