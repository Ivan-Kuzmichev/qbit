import type { Page } from '@playwright/test'
import { expect, MULTI_TORRENT, test, TINY_NAME, type Qb } from './fixtures'

// No saved language: what a new user gets.
test.use({ lang: null })

const SECTIONS = ['downloads', 'connection', 'speed', 'bittorrent', 'webui', 'notifications', 'appearance']

async function open(page: Page, qb: Qb, hash = '') {
  await page.context().addCookies(await qb.cookies())
  await page.goto(`/${hash}`)
}

/** Cyrillic anywhere a person or a screen reader meets it, and a page wider than the window. */
const problems = (page: Page, where: string) =>
  page.evaluate((where) => {
    const cyr = /[А-Яа-яЁё]/
    const found: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent!
      const el = walker.currentNode.parentElement!
      // The language picker names Russian in Russian on purpose.
      if (cyr.test(text) && !el.closest('script,style,[role=radiogroup]')) found.push(`${where} text: ${text.trim().slice(0, 50)}`)
    }
    for (const el of document.querySelectorAll('*')) {
      for (const a of ['aria-label', 'placeholder', 'title']) {
        const v = el.getAttribute(a)
        if (v && cyr.test(v)) found.push(`${where} ${a}: ${v}`)
      }
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) found.push(`${where}: wider than the window`)
    return found
  }, where)

test.describe('language', () => {
  test('a new user gets English on the login screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    expect(await problems(page, 'login')).toEqual([])
  })

  test('switching in settings reloads into the language and stays', async ({ page, qb }) => {
    await open(page, qb, '#/settings/appearance')
    await page.getByRole('radio', { name: 'Русский' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page.getByRole('radio', { name: 'Светлая' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('radio', { name: 'Светлая' })).toBeVisible()
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('radio', { name: 'Light' })).toBeVisible()
  })

  test('every desktop screen is free of Russian', async ({ page, qb, isMobile }) => {
    test.skip(isMobile)
    await qb.addTorrent()
    await qb.addTorrent(MULTI_TORRENT)
    await open(page, qb)
    const bad: string[] = []
    await page.getByRole('row', { name: new RegExp(TINY_NAME) }).click()
    bad.push(...(await problems(page, 'main')))
    for (const tab of ['Trackers', 'Peers', 'Info', 'Files']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(150)
      bad.push(...(await problems(page, `tab ${tab}`)))
    }
    await page.getByRole('row', { name: new RegExp(TINY_NAME) }).click({ button: 'right' })
    bad.push(...(await problems(page, 'context menu')))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add torrent' }).click()
    bad.push(...(await problems(page, 'add')))
    await page.getByRole('radio', { name: 'Magnet link' }).click()
    bad.push(...(await problems(page, 'add magnet')))
    await page.keyboard.press('Escape')
    await page.getByRole('row', { name: new RegExp(TINY_NAME) }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete…' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    bad.push(...(await problems(page, 'delete')))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Speed and limits' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    bad.push(...(await problems(page, 'limits')))
    await page.keyboard.press('Escape')
    for (const s of SECTIONS) {
      await page.goto(`/#/settings/${s}`)
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      await page.waitForTimeout(150)
      bad.push(...(await problems(page, `settings ${s}`)))
    }
    expect([...new Set(bad)]).toEqual([])
  })

  test('every phone screen is free of Russian and fits', async ({ page, qb, isMobile }) => {
    test.skip(!isMobile)
    await qb.addTorrent()
    await open(page, qb)
    const bad: string[] = []
    const row = page.getByRole('link', { name: new RegExp(TINY_NAME) })
    await expect(row).toBeVisible()
    bad.push(...(await problems(page, 'list')))
    await row.click()
    for (const tab of ['Trackers', 'Peers', 'Info', 'Files']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(150)
      bad.push(...(await problems(page, `tab ${tab}`)))
    }
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('button', { name: 'Add torrent' }).click()
    bad.push(...(await problems(page, 'add sheet')))
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    bad.push(...(await problems(page, 'settings')))
    for (const s of ['connection', 'bittorrent', 'webui', 'notifications', 'appearance']) {
      await page.goto(`/#/settings/${s}`)
      await page.waitForTimeout(200)
      bad.push(...(await problems(page, `settings ${s}`)))
    }
    expect([...new Set(bad)]).toEqual([])
  })
})
