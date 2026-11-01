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
  test.skip(({ isMobile }) => isMobile, 'desktop page; mobile settings are covered by mobile.spec.ts')

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

test.describe('alternative WebUI switch', () => {
  test.skip(({ isMobile }) => isMobile, 'same schema and save path on mobile')

  test('turning it off saves and hands the page over to the standard interface', async ({ page, qb }) => {
    await signIn(page)
    try {
      await page.getByRole('button', { name: 'Настройки' }).click()
      await page.getByRole('button', { name: 'WebUI', exact: true }).click()
      await page.getByRole('switch', { name: 'Использовать альтернативный WebUI' }).click()
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect.poll(async () => (await qb.prefs()).alternative_webui_enabled).toBe(false)
      await expect(page.locator('#root')).toHaveCount(0, { timeout: 10_000 })
    } finally {
      await qb.setPrefs({ alternative_webui_enabled: true, alternative_webui_path: '/qbit' })
    }
  })
})

test.describe('Telegram notifications', () => {
  test.skip(({ isMobile }) => isMobile, 'same schema and save path on mobile')

  test('saves a command qBittorrent keeps and turns on', async ({ page, qb }) => {
    const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
    await signIn(page)
    try {
      await page.getByRole('button', { name: 'Настройки' }).click()
      await page.getByRole('button', { name: 'Уведомления' }).click()
      await page.getByRole('switch', { name: 'Уведомлять о скачанных торрентах' }).click()
      await page.getByLabel('Токен бота').fill(token)
      await page.getByLabel('Chat ID').fill('42')
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect.poll(async () => (await qb.prefs()).autorun_enabled).toBe(true)
      expect((await qb.prefs()).autorun_program).toContain(`/bot${token}/sendMessage -d chat_id=42 `)
    } finally {
      await qb.setPrefs({ autorun_enabled: false, autorun_program: '' })
    }
  })
})
