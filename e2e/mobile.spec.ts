import type { Locator, Page } from '@playwright/test'
import { PASSWORD, USERNAME } from './env'
import { expect, MULTI_NAME, MULTI_TORRENT, test, TINY_NAME, TINY_TORRENT } from './fixtures'

test.skip(({ isMobile }) => !isMobile, 'mobile layout: the iphone project')

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Логин').fill(USERNAME)
  await page.getByRole('textbox', { name: 'Пароль' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Поиск торрентов' })).toBeVisible()
}

const INTERACTIVE = 'button, a[href], input, textarea, select, [role="switch"], [role="tab"], [role="radio"], [role="option"], [role="checkbox"]'

/**
 * The mobile rules of the spec, checked on whatever is on screen now: fields are 16px or more
 * (Safari zooms on focus otherwise), every control is 44px tall, the page does not scroll sideways.
 */
async function audit(page: Page, where: string) {
  const report = await page.evaluate((selector) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    // behind a modal sheet only the sheet is reachable
    const modal = document.querySelector('[role="dialog"]')
    const small: string[] = []
    const fields: string[] = []
    for (const el of (modal ?? document).querySelectorAll(selector)) {
      if (!visible(el)) continue
      const input = el as HTMLInputElement
      if (input.type === 'hidden' || (input.type === 'file')) continue
      // a field inside a label is tapped through the label, so the label is its tap zone
      const r = (/^(input|textarea|select)$/i.test(el.tagName) ? el.closest('label') ?? el : el).getBoundingClientRect()
      const name = `${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? ''}]`
      // an inline link inside a text paragraph is not a control of its own
      if (r.height < 43.5 && getComputedStyle(el).opacity !== '0') small.push(`${name} ${r.height.toFixed(1)}px`)
      if (/^(input|textarea|select)$/i.test(el.tagName) && !['checkbox', 'radio'].includes(input.type)) {
        const px = parseFloat(getComputedStyle(el).fontSize)
        if (px < 16) fields.push(`${name} ${px}px`)
      }
    }
    return {
      small,
      fields,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  }, INTERACTIVE)
  expect(report.fields, `${where}: field font size`).toEqual([])
  expect(report.small, `${where}: tap target height`).toEqual([])
  expect(report.overflow, `${where}: horizontal scroll`).toBeLessThanOrEqual(0)
}

async function torrentHash(qb: { maindata(): Promise<{ torrents?: Record<string, Record<string, unknown>> }> }, name: string) {
  let hash = ''
  await expect
    .poll(async () => {
      hash = Object.entries((await qb.maindata()).torrents ?? {}).find(([, x]) => x.name === name)?.[0] ?? ''
      return hash
    })
    .not.toBe('')
  return hash
}

const sheet = (page: Page) => page.getByRole('dialog')
/** Holds a pointer on the row for longer than the 500 ms the list waits for. */
async function longPress(page: Page, row: Locator) {
  const box = (await row.boundingBox())!
  await page.mouse.move(box.x + 40, box.y + 30)
  await page.mouse.down()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 })
  await page.mouse.up()
}
const size = async (loc: Locator) => (await loc.boundingBox())!

test.describe('mobile: PWA', () => {
  test('serves a standalone manifest, its icons and the head tags', async ({ page, request }) => {
    const res = await request.get('/manifest.json')
    expect(res.ok()).toBe(true)
    const manifest = await res.json()
    expect(manifest).toMatchObject({ display: 'standalone', theme_color: '#09090B', start_url: '.', scope: '.' })
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const r = await request.get(`/${icon.src}`)
      expect(r.ok(), icon.src).toBe(true)
      expect(r.headers()['content-type']).toContain('image/png')
    }
    expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true)

    await page.goto('/')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#09090B')
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.json$/)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  })
})

test.describe('mobile: screens', () => {
  test('the login screen follows the mobile rules, show-password included', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
    await audit(page, 'login')
    const field = page.getByRole('textbox', { name: 'Пароль' }).locator('..')
    const toggle = page.getByRole('button', { name: 'Показать пароль' })
    const f = await size(field)
    const b = await size(toggle)
    expect(b.y).toBeGreaterThanOrEqual(f.y - 1)
    expect(b.y + b.height).toBeLessThanOrEqual(f.y + f.height + 1)
  })

  test('list: the name is 14px, the row is as tall as MOBILE_ROW_HEIGHT, the rules hold', async ({ page, qb }) => {
    await qb.addTorrent()
    await signIn(page)
    const hash = await torrentHash(qb, TINY_NAME)
    const long = `${'Very.Long.Torrent.Name.'.repeat(8)}2026.1080p.WEB-DL.x265`
    const renamed = await page.request.post('/api/v2/torrents/rename', { form: { hash, name: long } })
    expect(renamed.ok()).toBe(true)

    const row = page.getByRole('list', { name: 'Торренты' }).getByRole('link', { name: new RegExp('Very\\.Long') })
    await expect(row).toBeVisible({ timeout: 10_000 })
    const name = row.getByText(/^Very\.Long/)
    expect(await name.evaluate((el) => getComputedStyle(el).fontSize)).toBe('14px')

    // natural height of the content vs the height the virtual list reserves
    const heights = await row.evaluate((a) => {
      const item = a.parentElement!
      const reserved = parseFloat(item.style.height)
      item.style.height = 'auto'
      a.style.height = 'auto'
      const natural = item.getBoundingClientRect().height
      item.style.height = `${reserved}px`
      a.style.height = ''
      return { reserved, natural }
    })
    expect(heights.natural).toBe(heights.reserved)

    await audit(page, 'list')
  })

  test('action sheet and its category view follow the rules', async ({ page, qb }) => {
    await qb.addTorrent()
    await signIn(page)
    const row = page.getByRole('list', { name: 'Торренты' }).getByRole('link', { name: new RegExp(TINY_NAME) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await longPress(page, row)
    await expect(sheet(page)).toBeVisible()
    await audit(page, 'action sheet')
    await sheet(page).getByRole('button', { name: 'Категория' }).click()
    await expect(sheet(page).getByRole('button', { name: 'Без категории' })).toBeVisible()
    await expect(sheet(page).getByRole('button', { name: 'Без категории' })).toBeFocused()
    await audit(page, 'category sheet')
  })

  test('torrent screen: tabs, file priority sheet, pause and back', async ({ page, qb }) => {
    await qb.addTorrent(MULTI_TORRENT)
    await signIn(page)
    await page.getByRole('list', { name: 'Торренты' }).getByRole('link', { name: new RegExp(MULTI_NAME) }).click()
    await expect(page.getByRole('heading', { name: MULTI_NAME })).toBeVisible()
    expect(await page.getByRole('heading', { name: MULTI_NAME }).evaluate((el) => getComputedStyle(el).fontSize)).toBe('18px')

    await expect(page.getByRole('button', { name: /^Приоритет: a\.bin/ })).toContainText('Обычный')
    await audit(page, 'torrent: files')

    const hash = await torrentHash(qb, MULTI_NAME)
    await page.getByRole('button', { name: /^Приоритет: a\.bin/ }).click()
    await audit(page, 'priority sheet')
    await sheet(page).getByRole('button', { name: 'Не загружать' }).click()
    await expect(page.getByRole('button', { name: /^Приоритет: a\.bin/ })).toContainText('Не качать')
    await expect.poll(async () => (await qb.files(hash)).find((f) => f.name.endsWith('a.bin'))?.priority).toBe(0)

    for (const tab of ['Трекеры', 'Пиры', 'Сведения']) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
      await audit(page, `torrent: ${tab}`)
    }

    // added stopped, so the bottom button offers to resume
    const resume = page.getByRole('button', { name: 'Возобновить' })
    await expect(resume).toBeVisible()
    await resume.click()
    await expect(page.getByRole('button', { name: 'Приостановить' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page).toHaveURL(/#\/$/)
  })

  test('torrent screen: Переместить and Удалить open dialogs that follow the rules; deleting returns to the list', async ({ page, qb }) => {
    await qb.addTorrent()
    await signIn(page)
    await page.getByRole('list', { name: 'Торренты' }).getByRole('link', { name: new RegExp(TINY_NAME) }).click()
    await expect(page.getByRole('heading', { name: TINY_NAME })).toBeVisible()

    await page.getByRole('button', { name: 'Переместить' }).click()
    await expect(sheet(page)).toBeVisible()
    await audit(page, 'move dialog')
    await sheet(page).getByRole('button', { name: 'Отмена' }).click()

    await page.getByRole('button', { name: 'Удалить', exact: true }).click()
    await expect(sheet(page)).toBeVisible()
    await audit(page, 'delete dialog')
    await sheet(page).getByRole('button', { name: 'Удалить', exact: true }).click()
    await expect(page).toHaveURL(/#\/$/, { timeout: 10_000 })
  })

  test('the torrent screen goes back to the list when the torrent is removed elsewhere', async ({ page, qb }) => {
    await qb.addTorrent()
    await signIn(page)
    await page.getByRole('list', { name: 'Торренты' }).getByRole('link', { name: new RegExp(TINY_NAME) }).click()
    await expect(page).toHaveURL(/#\/torrent\//)
    await qb.removeAll()
    await expect(page).toHaveURL(/#\/$/, { timeout: 10_000 })
  })

  test('the speed limits dialog from the action sheet follows the rules', async ({ page, qb }) => {
    await qb.addTorrent()
    await signIn(page)
    const row = page.getByRole('list', { name: 'Торренты' }).getByRole('link', { name: new RegExp(TINY_NAME) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await longPress(page, row)
    await sheet(page).getByRole('button', { name: 'Ограничение скорости' }).click()
    await expect(sheet(page).getByRole('button', { name: 'Применить' })).toBeVisible()
    await audit(page, 'limits dialog')
  })
})

test.describe('mobile: add sheet', () => {
  test('a .torrent file is added stopped; both tabs follow the rules', async ({ page, qb }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Добавить торрент' }).click()
    const add = page.getByRole('dialog', { name: 'Добавить торрент' })
    await expect(add).toBeVisible()
    await add.getByTestId('file-input').setInputFiles(TINY_TORRENT)
    await expect(add.getByText('tiny.torrent')).toBeVisible()
    await audit(page, 'add: file')
    await add.getByRole('switch', { name: 'Запустить сразу' }).click()
    await add.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(add).toBeHidden()
    await expect
      .poll(async () => Object.values((await qb.maindata()).torrents ?? {}).map((x) => [x.name, x.state]), { timeout: 15_000 })
      .toEqual([[TINY_NAME, 'stoppedDL']])
  })

  test('a magnet from the footer button is added with the typed folder', async ({ page, qb }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Добавить magnet' }).click()
    const add = page.getByRole('dialog', { name: 'Добавить торрент' })
    await expect(add.getByRole('radio', { name: 'Magnet' })).toBeChecked()
    const hash = 'a3f9c2d17be05f4c9e8a2b6d0c1f73e98e41d000'
    await add.getByLabel('Magnet-ссылки').fill(`magnet:?xt=urn:btih:${hash}&dn=mobile-e2e-magnet`)
    await audit(page, 'add: magnet')
    await add.getByRole('switch', { name: 'Запустить сразу' }).click()
    await add.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(add).toBeHidden()
    await expect.poll(async () => Object.keys((await qb.maindata()).torrents ?? {}), { timeout: 15_000 }).toContain(hash)
  })
})

test.describe('mobile: settings', () => {
  test('groups, a sheet, a section and the save', async ({ page, qb }) => {
    const before = await qb.prefs()
    try {
      await signIn(page)
      await page.getByRole('button', { name: 'Настройки' }).click()
      await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
      await expect(page.getByRole('switch', { name: 'Добавлять на паузе' })).toBeVisible()
      await audit(page, 'settings')

      await page.getByRole('button', { name: /Лимит загрузки/ }).click()
      await expect(sheet(page)).toBeVisible()
      await audit(page, 'setting sheet')
      await sheet(page).getByRole('button', { name: 'Отмена' }).click()

      for (const name of ['Соединение', 'BitTorrent', 'WebUI', 'Внешний вид']) {
        await page.getByRole('button', { name: new RegExp(name) }).click()
        await expect(page.getByRole('heading', { name })).toBeVisible()
        await audit(page, `settings: ${name}`)
        await page.getByRole('button', { name: 'Назад' }).click()
      }

      const was = Boolean(before.add_stopped_enabled)
      await page.getByRole('switch', { name: 'Добавлять на паузе' }).click()
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect.poll(async () => (await qb.prefs()).add_stopped_enabled).toBe(!was)
    } finally {
      await qb.setPrefs({ add_stopped_enabled: before.add_stopped_enabled })
    }
  })

  test('Выйти returns to the login screen', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: 'Настройки' }).click()
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
  })
})
