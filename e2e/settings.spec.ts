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

test.describe('settings page', () => {
  test.skip(({ isMobile }) => isMobile, 'mobile settings arrive in a later stage')

  test('enabling ratio from the off state needs a value and then persists', async ({ page, qb }) => {
    await qb.setPrefs({ max_ratio_enabled: false })
    try {
      await signIn(page)
      await page.getByRole('button', { name: 'Настройки' }).click()
      await page.getByRole('switch', { name: 'Останавливать при ratio' }).click()
      await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
      await page.getByLabel('Ratio', { exact: true }).fill('2')
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect
        .poll(async () => {
          const p = await qb.prefs()
          return [p.max_ratio_enabled, p.max_ratio]
        })
        .toEqual([true, 2])
    } finally {
      await qb.setPrefs({ max_ratio_enabled: false })
    }
  })
})
