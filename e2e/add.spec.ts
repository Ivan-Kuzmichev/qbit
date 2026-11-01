import type { Page } from '@playwright/test'
import { PASSWORD, USERNAME } from './env'
import { expect, HYBRID_NAME, HYBRID_TORRENT, MULTI_NAME, MULTI_TORRENT, test, TINY_NAME, TINY_TORRENT } from './fixtures'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Логин').fill(USERNAME)
  await page.getByRole('textbox', { name: 'Пароль' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible()
}

async function openAdd(page: Page, file: string) {
  await page.getByRole('button', { name: 'Добавить торрент' }).click()
  const dialog = page.getByRole('dialog', { name: 'Добавить торрент' })
  await dialog.getByTestId('file-input').setInputFiles(file)
  return dialog
}

test.describe('add torrent dialog', () => {
  test.skip(({ isMobile }) => isMobile, 'mobile entry points arrive in a later stage')

  test('a file added with "start now" off lands stopped', async ({ page, qb }) => {
    await signIn(page)
    const dialog = await openAdd(page, TINY_TORRENT)
    await expect(dialog.getByText(TINY_NAME).first()).toBeVisible()
    await dialog.getByRole('checkbox', { name: 'Запустить сразу' }).uncheck()
    await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(dialog).toBeHidden()

    await expect
      .poll(async () => Object.values((await qb.maindata()).torrents ?? {}).map((x) => [x.name, x.state]), { timeout: 15_000 })
      .toEqual([[TINY_NAME, 'stoppedDL']])
  })

  test('an unchecked file gets priority 0 and the torrent stays stopped', async ({ page, qb }) => {
    await signIn(page)
    const dialog = await openAdd(page, MULTI_TORRENT)
    await expect(dialog.getByText('выбрано 2 из 2')).toBeVisible()
    await dialog.getByRole('checkbox', { name: /b\.bin/ }).uncheck()
    await dialog.getByRole('checkbox', { name: 'Запустить сразу' }).uncheck()
    await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(dialog).toBeHidden()

    let hash = ''
    await expect
      .poll(
        async () => {
          // maindata keys torrents by hash; the record itself has no `hash` field
          const found = Object.entries((await qb.maindata()).torrents ?? {}).find(([, x]) => x.name === MULTI_NAME)
          hash = found?.[0] ?? ''
          return found?.[1].state
        },
        { timeout: 15_000 },
      )
      .toBe('stoppedDL')
    await expect
      .poll(async () => (await qb.files(hash)).map((f) => [f.name, f.priority]), { timeout: 15_000 })
      .toEqual([
        [`${MULTI_NAME}/a.bin`, 1],
        [`${MULTI_NAME}/b.bin`, 0],
      ])
  })

  test('a hybrid torrent with an unchecked file is found and gets priority 0', async ({ page, qb }, info) => {
    await signIn(page)
    const dialog = await openAdd(page, HYBRID_TORRENT)
    await expect(dialog.getByText('выбрано 2 из 2')).toBeVisible()
    await dialog.getByRole('checkbox', { name: /b\.bin/ }).uncheck()
    await dialog.getByRole('checkbox', { name: 'Запустить сразу' }).uncheck()
    await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(dialog).toBeHidden()

    let hash = ''
    await expect
      .poll(
        async () => {
          const found = Object.entries((await qb.maindata()).torrents ?? {}).find(([, x]) => x.name === HYBRID_NAME)
          hash = found?.[0] ?? ''
          return found?.[1].state
        },
        { timeout: 40_000 },
      )
      .toBe('stoppedDL')
    info.annotations.push({ type: 'qBittorrent hash of the hybrid', description: hash })
    await expect
      .poll(async () => (await qb.files(hash)).map((f) => [f.name, f.priority]), { timeout: 15_000 })
      .toEqual([
        [`${HYBRID_NAME}/a.bin`, 1],
        [`${HYBRID_NAME}/b.bin`, 0],
      ])
  })
})
