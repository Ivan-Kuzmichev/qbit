import type { Page } from '@playwright/test'
import { PASSWORD, USERNAME } from './env'
import { expect, MULTI_NAME, MULTI_TORRENT, PADDED_NAME, PADDED_TORRENT, test } from './fixtures'

test('torrents/files leaves out BEP 47 pad files and indexes the rest from 0', async ({ qb }) => {
  await qb.addTorrent(PADDED_TORRENT)
  let hash = ''
  await expect
    .poll(
      async () => {
        const found = Object.entries((await qb.maindata()).torrents ?? {}).find(([, x]) => x.name === PADDED_NAME)
        hash = found?.[0] ?? ''
        return hash !== ''
      },
      { timeout: 15_000 },
    )
    .toBe(true)

  await expect.poll(async () => (await qb.files(hash)).map((f) => [f.index, f.name]), { timeout: 15_000 }).toEqual([
    [0, `${PADDED_NAME}/a.bin`],
    [1, `${PADDED_NAME}/b.bin`],
  ])

  await qb.filePrio(hash, '1', 0)
  await expect.poll(async () => (await qb.files(hash)).map((f) => [f.name, f.priority])).toEqual([
    [`${PADDED_NAME}/a.bin`, 1],
    [`${PADDED_NAME}/b.bin`, 0],
  ])
})

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Логин').fill(USERNAME)
  await page.getByRole('textbox', { name: 'Пароль' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible()
}

test.describe('files tab', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop details card; the mobile screen is covered by mobile.spec.ts')

  test('unchecking a file and picking a priority reach qBittorrent', async ({ page, qb }) => {
    await qb.addTorrent(MULTI_TORRENT)
    await signIn(page)
    await page.getByRole('row', { name: new RegExp(MULTI_NAME) }).click()
    const card = page.getByRole('region', { name: 'Детали торрента' })
    const hash = Object.keys((await qb.maindata()).torrents ?? {})[0]

    await card.getByRole('checkbox', { name: 'b.bin' }).uncheck()
    await expect(card.getByRole('checkbox', { name: 'b.bin' })).not.toBeChecked()
    await expect.poll(async () => (await qb.files(hash)).map((f) => f.priority)).toEqual([1, 0])

    await card.getByRole('button', { name: 'Приоритет: a.bin' }).click()
    await page.getByRole('menuitem', { name: 'Максимальный' }).click()
    await expect.poll(async () => (await qb.files(hash)).map((f) => f.priority)).toEqual([7, 0])
    await expect(card.getByRole('button', { name: 'Приоритет: a.bin' })).toHaveText('Максимальный')
  })
})
