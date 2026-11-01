import { PASSWORD, USERNAME } from './env'
import type { Page } from '@playwright/test'
import { expect, test, TINY_NAME } from './fixtures'

async function signIn(page: Page, password = PASSWORD) {
  await page.goto('/')
  await page.getByLabel('Логин').fill(USERNAME)
  await page.getByRole('textbox', { name: 'Пароль' }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
}

test.describe('stage 1: login, sync, table', () => {
  test('serves the built UI and every request stays on the same origin', async ({ page, baseURL }) => {
    const origins = new Set<string>()
    const apiPaths = new Set<string>()
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (url.pathname.startsWith('/api/v2/')) apiPaths.add(url.pathname)
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin)
    })

    await signIn(page)
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeHidden()

    await expect.poll(() => apiPaths.has('/api/v2/sync/maindata')).toBe(true)
    expect([...origins]).toEqual([new URL(baseURL!).origin])
  })

  test('wrong password shows an error and stays on the login screen', async ({ page }) => {
    await signIn(page, 'definitely-wrong')
    await expect(page.getByRole('alert')).toHaveText('Неверный логин или пароль')
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
  })

  test('login shows the torrent table; an added torrent appears without reload', async ({ page, isMobile, qb }) => {
    test.skip(isMobile, 'mobile list arrives in a later stage')

    await signIn(page)

    const table = page.getByRole('grid')
    await expect(table).toBeVisible()
    await expect(table.getByRole('row', { name: new RegExp(TINY_NAME) })).toHaveCount(0)

    await page.evaluate(() => {
      ;(window as unknown as { __marker: number }).__marker = 1
    })
    await qb.addTorrent()
    await expect(table.getByRole('row', { name: new RegExp(TINY_NAME) })).toBeVisible({ timeout: 10_000 })
    // still the same document: no reload happened
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1)
  })

  test('mobile: login shows the list; an added torrent appears as a row that opens its screen', async ({ page, isMobile, qb }) => {
    test.skip(!isMobile, 'desktop covered above')
    await signIn(page)
    await expect(page.getByRole('main')).toBeVisible()

    const list = page.getByRole('list', { name: 'Торренты' })
    await expect(page.getByRole('textbox', { name: 'Поиск торрентов' })).toBeVisible()
    await qb.addTorrent()
    const row = list.getByRole('link', { name: new RegExp(TINY_NAME) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()
    await expect(page).toHaveURL(/#\/torrent\/[0-9a-f]+$/)
  })
})
