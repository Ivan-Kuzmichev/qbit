import type { Page } from '@playwright/test'
import { expect, test, TINY_NAME, type Qb } from './fixtures'

const ACCENTS = ['#60A5FA', '#A78BFA', '#22D3EE', '#FBBF24']

async function open(page: Page, qb: Qb, theme: string | null, hash = '', accent?: string) {
  await page.context().addCookies(await qb.cookies())
  await page.addInitScript(
    ([t, a]) => {
      if (t && !localStorage.getItem('qbit.theme')) localStorage.setItem('qbit.theme', t)
      if (a) localStorage.setItem('qbit.accent', a)
    },
    [theme, accent ?? null],
  )
  await page.goto(`/${hash}`)
}
const themeOf = (page: Page) => page.locator('html').getAttribute('data-theme')

/** Every piece of visible text whose contrast against its effective background is under 4.5:1. */
const lowContrast = (page: Page) =>
  page.evaluate(() => {
    const parse = (c: string): number[] => {
      const n = c.match(/-?[\d.]+(?:e-?\d+)?/g)!.map(Number)
      if (c.startsWith('color(')) return [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1]
      return [n[0], n[1], n[2], n[3] ?? 1]
    }
    const over = (f: number[], b: number[]) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1)
    const lum = (c: number[]) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const background = (el: Element): number[] => {
      const stack: number[][] = []
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor)
        if (c[3] > 0) stack.push(c)
        if (c[3] === 1) break
      }
      return stack.reduceRight((b, f) => over(f, b), [255, 255, 255, 1])
    }
    const bad: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent!.trim()
      const el = walker.currentNode.parentElement!
      if (!text || el.closest('script,style,option,[disabled],[aria-disabled="true"]')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue
      const bg = background(el)
      const fg = over(parse(cs.color), bg)
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
      const ratio = (hi + 0.05) / (lo + 0.05)
      if (ratio < 4.5) bad.push(`${ratio.toFixed(2)} ${cs.color} on ${bg.slice(0, 3).map(Math.round)}: ${text.slice(0, 40)}`)
    }
    return bad
  })

test.describe('theme', () => {
  test('dark by default, and the switch lasts across a reload', async ({ page, qb }) => {
    await open(page, qb, null, '#/settings/appearance')
    expect(await themeOf(page)).toBe('dark')
    await page.getByRole('radio', { name: 'Светлая' }).click()
    expect(await themeOf(page)).toBe('light')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 244, 245)')
    await page.reload()
    expect(await themeOf(page)).toBe('light')
  })

  test('set before the app loads, so nothing flashes', async ({ page, qb }) => {
    await page.route('**/assets/*.js', (r) => r.abort())
    await open(page, qb, 'light')
    expect(await themeOf(page)).toBe('light')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F4F4F5')
  })

  test('system follows the OS live', async ({ page, qb }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await open(page, qb, 'system')
    expect(await themeOf(page)).toBe('light')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => themeOf(page)).toBe('dark')
  })
})

test.describe('light theme contrast', () => {
  test.skip(({ isMobile }) => isMobile, 'mobile uses the same tokens; audited on desktop')

  for (const accent of ACCENTS) {
    test(`main screen with accent ${accent}`, async ({ page, qb }) => {
      await qb.addTorrent()
      await open(page, qb, 'light', '', accent)
      await page.getByRole('row', { name: new RegExp(TINY_NAME) }).click()
      await expect(page.getByRole('tab', { name: 'Файлы' })).toBeVisible()
      expect(await lowContrast(page)).toEqual([])
    })
  }

  test('details tabs, dialogs and settings', async ({ page, qb }) => {
    await qb.addTorrent()
    await open(page, qb, 'light')
    await page.getByRole('row', { name: new RegExp(TINY_NAME) }).click()
    const bad: string[] = []
    for (const tab of ['Трекеры', 'Пиры', 'Сведения']) {
      await page.getByRole('tab', { name: tab }).click()
      bad.push(...(await lowContrast(page)))
    }
    await page.getByRole('button', { name: 'Добавить торрент' }).click()
    bad.push(...(await lowContrast(page)))
    await page.keyboard.press('Escape')
    for (const section of ['downloads', 'connection', 'speed', 'bittorrent', 'webui', 'notifications', 'appearance']) {
      await page.goto(`/#/settings/${section}`)
      await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Сохранить' })).toBeVisible()
      await page.waitForTimeout(100)
      bad.push(...(await lowContrast(page)))
    }
    expect([...new Set(bad)]).toEqual([])
  })
})
