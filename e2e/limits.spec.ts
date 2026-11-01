import type { Page } from '@playwright/test'
import { PASSWORD, USERNAME } from './env'
import { expect, test } from './fixtures'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Логин').fill(USERNAME)
  await page.getByRole('textbox', { name: 'Пароль' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible()
}

test.describe('speed limits dialog', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop dialog; the mobile sheet is covered by mobile.spec.ts')

  test('alt_dl_limit is in bytes/s: 5 MB/s shows up as 5242880 in server_state', async ({ page, qb }) => {
    await qb.setPrefs({ alt_dl_limit: 0, alt_up_limit: 0 })
    try {
      await signIn(page)
      await page.getByRole('button', { name: 'Скорость и лимиты' }).click()
      const dialog = page.getByRole('dialog', { name: 'Ограничение скорости' })
      await expect(dialog.getByRole('radio', { name: 'Глобальные' })).toBeChecked()
      await dialog.getByRole('radio', { name: 'Альтернативные' }).click()
      await dialog.getByLabel('Загрузка').fill('5')
      await dialog.getByRole('button', { name: 'Применить' }).click()
      await expect(dialog).toBeHidden()

      expect((await qb.prefs()).alt_dl_limit).toBe(5 * 1024 * 1024)
      await page.getByRole('switch', { name: 'Альт. лимиты' }).click()
      await expect
        .poll(async () => (await qb.maindata()).server_state?.dl_rate_limit, { timeout: 15_000 })
        .toBe(5 * 1024 * 1024)
      await page.getByRole('switch', { name: 'Альт. лимиты' }).click()
      await expect.poll(async () => (await qb.maindata()).server_state?.use_alt_speed_limits).toBe(false)
    } finally {
      await qb.setPrefs({ alt_dl_limit: 0, alt_up_limit: 0 })
    }
  })

  test('the torrent tab sets a per-torrent limit from the context menu', async ({ page, qb }) => {
    await qb.addTorrent()
    await signIn(page)
    await page.getByRole('row').nth(1).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Ограничение скорости…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ограничение скорости' })
    await dialog.getByLabel('Отдача').fill('1,5')
    await dialog.getByRole('button', { name: 'Применить' }).click()
    await expect(dialog).toBeHidden()
    await expect
      .poll(async () => Object.values((await qb.maindata()).torrents ?? {})[0]?.up_limit, { timeout: 15_000 })
      .toBe(1572864)
  })
})
