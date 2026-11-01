import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { HASH, mockApi, sampleTorrent, type MockOptions } from './mockData'

/**
 * `npm run visual`: builds the app, serves the bundle, renders every screen with the mockups' sample data, saves a screenshot and
 * compares computed styles and boxes with the values read from the inline styles of design/*.dc.html.
 * Where the spec overrides a mockup the expected value is the spec's, and a comment says so.
 * Output: test-results/visual/ (screenshots and measurements/*.md).
 */

const OUT = 'test-results/visual'
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

// Tokens as the browser reports them.
const hex = (h: string) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`
const BG = hex('#09090B')
const SURFACE = hex('#0C0C0E')
const CARD = hex('#0F0F12')
const SELECTED = hex('#16171B')
const HOVER = hex('#18181B')
const CHIP = hex('#1C1C20')
const BORDER = hex('#27272A')
const SUBTLE = hex('#1F1F23')
const DIVIDER = hex('#18181B')
const TEXT = hex('#FAFAFA')
const TEXT2 = hex('#D4D4D8')
const MUTED = hex('#A1A1AA')
const DIM = hex('#71717A')
const ACCENT = hex('#60A5FA')
const SEED = hex('#4ADE80')
const DANGER = hex('#F87171')
const DANGER_BG = hex('#DC2626')
const DANGER_TEXT = hex('#FCA5A5')
const NEUTRAL = hex('#3F3F46')
const CONTROL = hex('#52525B')
const NONE = 'rgba(0, 0, 0, 0)'
const SANS = 'Inter'
const MONO = 'JetBrains Mono'

type Want = Record<string, string | number>
interface Row {
  screen: string
  element: string
  prop: string
  want: string | number
  got: string | number
  ok: boolean
}

const rows: Row[] = []

/** Computed style plus w, h, x, y from the bounding box and `text` for the text content. */
async function measure(screen: string, element: string, at: Locator, want: Want) {
  const missing = await at.first().waitFor({ state: 'attached', timeout: 1500 }).then(() => false, () => true)
  if (missing) {
    rows.push({ screen, element, prop: 'exists', want: 'yes', got: 'missing', ok: false })
    return
  }
  const got = await at.first().evaluate((el, keys) => {
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    const out: Record<string, string | number> = {}
    for (const k of keys) {
      if (k === 'w') out[k] = box.width
      else if (k === 'h') out[k] = box.height
      else if (k === 'x') out[k] = box.x
      else if (k === 'y') out[k] = box.y
      else if (k === 'text') out[k] = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim()
      else if (k === 'centerY') out[k] = box.y + box.height / 2
      else out[k] = style.getPropertyValue(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))
    }
    return out
  }, Object.keys(want))
  for (const [prop, value] of Object.entries(want)) {
    const actual = got[prop]
    const ok =
      typeof value === 'number'
        ? Math.abs(parseFloat(String(actual)) - value) <= 0.51
        : prop === 'fontFamily'
          ? String(actual).replace(/"/g, '').startsWith(value)
          : actual === value
    rows.push({ screen, element, prop, want: value, got: actual, ok })
  }
}

const cls = (root: Page | Locator, name: string) => root.locator(`[class*="_${name}_"]`)

async function open(page: Page, viewport: { width: number; height: number }, hash: string, opts?: MockOptions) {
  await mockApi(page, opts)
  await page.setViewportSize(viewport)
  await page.addInitScript(() => localStorage.setItem('qbit.versions', JSON.stringify({ app: 'v5.1.2', api: '2.11.4' })))
  await page.goto(`/${hash}`)
  await page.evaluate(() => document.fonts.ready)
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
  await page.mouse.move(0, 0)
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

/** Desktop main screen, first torrent selected, Files tab open. */
async function openMain(page: Page) {
  await open(page, DESKTOP, '')
  await page.locator(`[data-hash="${HASH}"]`).click({ position: { x: 300, y: 10 } })
  await expect(page.locator('[data-details] [data-kind="file"]').first()).toBeVisible()
  // a couple of polls, so that the sparkline has something to draw
  await page.waitForTimeout(2500)
}

// A failed test restarts the worker and loses `rows`, so every test leaves its own table.
// eslint-disable-next-line no-empty-pattern -- Playwright insists on the destructuring
test.afterEach(async ({}, info) => {
  mkdirSync(`${OUT}/measurements`, { recursive: true })
  const lines = ['| Screen | Element | Property | Mockup/spec | App | |', '|---|---|---|---|---|---|']
  for (const r of rows) lines.push(`| ${r.screen} | ${r.element} | ${r.prop} | ${r.want} | ${r.got} | ${r.ok ? 'ok' : 'DIFF'} |`)
  writeFileSync(`${OUT}/measurements/${info.title.replace(/\s+/g, '-')}.md`, lines.join('\n') + '\n')
  rows.length = 0
})

function verdict(screen: string) {
  const bad = rows.filter((r) => r.screen === screen && !r.ok)
  expect(bad.map((r) => `${r.element} ${r.prop}: want ${r.want}, got ${r.got}`)).toEqual([])
}

test('desktop main', async ({ page }) => {
  const S = 'Main'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await openMain(page)
  await shot(page, 'desktop-main')

  // Sidebar
  const side = page.locator('aside')
  await m('sidebar', side, { w: 236, backgroundColor: SURFACE, paddingTop: '20px', paddingLeft: '12px', paddingBottom: '16px', borderRightColor: SUBTLE, rowGap: '20px' })
  await m('logo', cls(side, 'logo'), { w: 28, h: 28, borderRadius: '8px', backgroundColor: ACCENT, color: BG })
  await m('brand name', cls(side, 'name'), { fontSize: '16px', fontWeight: '600', letterSpacing: '-0.16px', fontFamily: SANS })
  const filters = side.getByRole('navigation').getByRole('button')
  await m('filter, active', filters.nth(0), { h: 38, fontSize: '13px', backgroundColor: HOVER, color: TEXT, borderRadius: '8px', paddingLeft: '10px', columnGap: '10px' })
  await m('filter, idle', filters.nth(1), { backgroundColor: NONE, color: TEXT2 })
  await m('filter gap', side.getByRole('navigation'), { rowGap: '2px' })
  await m('count, active', cls(filters.nth(0), 'count'), { h: 18, backgroundColor: ACCENT, color: BG, fontFamily: MONO, fontSize: '11px', borderRadius: '9px' })
  await m('count, idle', cls(filters.nth(1), 'count'), { backgroundColor: CHIP, color: MUTED })
  // Speed card
  const speed = cls(side, 'card')
  await m('speed card', speed, { padding: '14px', borderRadius: '12px', backgroundColor: CARD, borderTopColor: BORDER, rowGap: '8px' })
  await m('speed title', cls(speed, 'title'), { fontSize: '11px', fontWeight: '500', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.88px' })
  await m('speed value', cls(speed, 'value'), { fontSize: '26px', fontWeight: '400', color: ACCENT, text: '21.7' })
  await m('speed unit', cls(speed, 'unit'), { fontFamily: MONO, fontSize: '12px', color: MUTED })
  await m('speed meta', cls(speed, 'meta'), { fontFamily: MONO, fontSize: '12px', color: MUTED, paddingTop: '8px', borderTopColor: SUBTLE })
  await m('alt row', cls(speed, 'alt'), { h: 32, borderRadius: '8px', paddingLeft: '8px', columnGap: '8px', fontSize: '12px', color: TEXT2, borderTopColor: BORDER })
  await m('alt icon', cls(speed, 'alt').locator('svg'), { w: 14, h: 14 })
  // spec: the switch is 36×20 everywhere; the mockup's card draws a smaller 28×16 one
  await m('alt toggle', page.getByRole('switch', { name: 'Альт. лимиты' }), { w: 36, h: 20 })
  await m('settings item', side.getByRole('button', { name: 'Настройки' }), { h: 38, fontSize: '13px', color: TEXT2 })

  // Top bar
  const content = page.getByRole('textbox', { name: 'Поиск торрентов' }).locator('xpath=ancestor::label')
  await m('search', content, { x: 256, y: 14, h: 38, borderRadius: '10px', backgroundColor: CARD, borderTopColor: BORDER, columnGap: '10px', paddingLeft: '12px' })
  await m('search input', page.getByRole('textbox', { name: 'Поиск торрентов' }), { fontSize: '12.5px', fontFamily: SANS })
  await m('add torrent', page.getByRole('button', { name: 'Добавить торрент' }), { h: 38, borderRadius: '10px', backgroundColor: ACCENT, color: BG, fontWeight: '600', fontSize: '12.5px', paddingLeft: '16px', columnGap: '8px' })
  await m('add magnet', page.getByRole('button', { name: 'Добавить magnet' }), { h: 38, borderRadius: '10px', backgroundColor: CARD, color: TEXT, fontWeight: '500', fontSize: '12.5px', paddingLeft: '14px', borderTopColor: BORDER })
  await m('pause all', page.getByRole('button', { name: 'Пауза для всех' }), { h: 38, fontSize: '12.5px', fontWeight: '500' })

  // Table
  const grid = page.getByRole('grid')
  const card = cls(page, 'card').filter({ has: grid })
  await m('table card', card, { x: 256, y: 66, w: 1164, borderRadius: '12px', backgroundColor: CARD, borderTopColor: BORDER })
  const head = grid.getByRole('row').first()
  await m('table head', head, { h: 40, fontSize: '12px', color: MUTED, borderBottomColor: SUBTLE, gridTemplateColumns: '52px 540px 140px 220px 110px 84px', paddingRight: '16px' })
  const first = page.locator(`[data-hash="${HASH}"]`)
  await m('row, selected', first, { h: 48, backgroundColor: SELECTED, boxShadow: `${ACCENT} 3px 0px 0px 0px inset`, borderBottomColor: DIVIDER })
  await m('row action', first.getByRole('button'), { w: 32, h: 32, x: 267, color: ACCENT, borderRadius: '8px' })
  await m('row action icon', first.getByRole('button').locator('svg'), { w: 14, h: 14 })
  await m('row name', cls(first, 'title'), { fontSize: '13px', fontWeight: '500', color: TEXT, fontFamily: SANS })
  await m('row sub', cls(first, 'sub'), { fontSize: '11px', color: MUTED, text: '54 пира · осталось 8 мин' })
  await m('row name gap', cls(first, 'name'), { rowGap: '3px', paddingRight: '16px' })
  await m('row status', cls(first, 'status'), { fontSize: '12px', color: ACCENT, columnGap: '7px' })
  await m('row bar', first.getByRole('progressbar'), { h: 12 })
  await m('row bar cell', cls(first, 'progress'), { columnGap: '14px' })
  await m('row percent', cls(first, 'pct'), { w: 40, fontFamily: MONO, fontSize: '12px', fontWeight: '500', textAlign: 'right' })
  const cells = first.getByRole('gridcell')
  await m('row speed', cells.nth(4), { fontFamily: MONO, fontSize: '12px', color: TEXT, textAlign: 'right', text: '↓ 12.1 МБ/с' })
  await m('row size', cells.nth(5), { fontFamily: MONO, fontSize: '12px', fontWeight: '500', textAlign: 'right', text: '4.20 ГБ' })
  const paused = page.getByRole('row').filter({ hasText: 'Big.Buck.Bunny' })
  await m('row speed, idle', paused.getByRole('gridcell').nth(4), { color: DIM, text: '—' })
  await m('row action, idle', paused.getByRole('button'), { color: MUTED })

  // Details
  const details = page.locator('[data-details]')
  await m('details', details, { borderRadius: '12px', backgroundColor: CARD, borderTopColor: BORDER })
  await m('details top', cls(details, 'top').first(), { padding: '18px 18px 14px', rowGap: '20px', columnGap: '20px' })
  await m('piece map', cls(details, 'map'), { w: 100, h: 100, rowGap: '2px', columnGap: '2px' })
  await m('details title', details.getByRole('heading'), { fontSize: '16px', fontWeight: '600', letterSpacing: '-0.16px' })
  await m('details pause', details.getByRole('button', { name: 'Приостановить' }), { h: 34, borderRadius: '9px', paddingLeft: '14px', fontSize: '12.5px', fontWeight: '500', color: TEXT, borderTopColor: BORDER })
  const chips = cls(details, 'chips').locator('> *')
  await m('chip, status', chips.nth(0), { h: 22, paddingLeft: '9px', borderRadius: '6px', backgroundColor: ACCENT, color: BG, fontSize: '11px', fontWeight: '600' })
  await m('chip', chips.nth(1), { h: 22, paddingLeft: '9px', backgroundColor: CHIP, color: TEXT2, fontSize: '11px', fontWeight: '400', text: '4 файла' })
  await m('chips gap', cls(details, 'chips'), { columnGap: '6px' })
  await m('details bar', details.getByRole('progressbar', { name: '62%' }), { h: 14 })
  await m('details percent', cls(details, 'percent'), { fontSize: '18px', fontWeight: '600', letterSpacing: '-0.36px', text: '62%' })
  await m('details progress row', cls(details, 'progressRow'), { columnGap: '16px' })
  await m('details icon button', details.getByRole('button', { name: 'Переместить' }), { w: 32, h: 32, color: MUTED })
  await m('details delete button', details.getByRole('button', { name: 'Удалить' }), { w: 32, h: 32, color: DANGER })
  await m('details stats', cls(details, 'stats'), { fontFamily: MONO, fontSize: '12px', color: MUTED, columnGap: '18px' })
  await m('details stats value', cls(details, 'stats').locator('b').first(), { color: TEXT, fontWeight: '500', text: '12.1 МБ/с' })
  // Tabs
  const tablist = details.getByRole('tablist')
  await m('tab bar', tablist.locator('xpath=..'), { paddingLeft: '12px', borderBottomColor: SUBTLE, x: 257, w: 1162 })
  await m('tabs', tablist, { columnGap: '4px', h: 40 })
  await m('tab, active', tablist.getByRole('tab').nth(0), { h: 40, paddingLeft: '10px', fontWeight: '500', color: TEXT, borderBottomColor: ACCENT, fontSize: '12.5px' })
  await m('tab, idle', tablist.getByRole('tab').nth(1), { h: 40, fontWeight: '400', color: MUTED })
  await m('tab panel', details.getByRole('tabpanel'), { padding: '4px 18px 12px' })
  // Files
  const on = details.locator('[data-kind="file"]').filter({ hasText: 'splash_scene.blend' })
  const off = details.locator('[data-kind="file"]').filter({ hasText: 'hdri_8k.exr' })
  await m('file row', on, { paddingTop: '10px', alignItems: 'center' })
  await m('file checkbox', cls(on, 'box'), { w: 15, h: 15, borderRadius: '4px', backgroundColor: ACCENT, borderTopColor: ACCENT })
  await m('file checkbox, off', cls(off, 'box'), { w: 15, h: 15, backgroundColor: NONE, borderTopColor: CONTROL })
  await m('file cell', cls(on, 'cell'), { rowGap: '8px' })
  await m('file line', cls(on, 'line'), { columnGap: '12px' })
  await m('file name', cls(on, 'name'), { color: TEXT, fontSize: '12.5px' })
  // contrast ≥ 4.5:1 (spec) beats the mockup's #71717A here
  await m('file name, off', cls(off, 'name'), { color: MUTED })
  await m('file size', cls(on, 'size'), { fontFamily: MONO, fontSize: '12px', color: MUTED, text: '2.90 ГБ' })
  await m('file priority', on.getByRole('button'), { w: 116, h: 22, borderRadius: '6px', fontSize: '11px', paddingLeft: '8px', paddingRight: '6px', borderTopColor: BORDER })
  await m('file priority, max', on.getByRole('button'), { color: ACCENT, text: 'Максимальный' })
  await m('file priority, normal', details.locator('[data-kind="file"]').filter({ hasText: 'hdri_4k.exr' }).getByRole('button'), { color: TEXT2, text: 'Обычный' })
  await m('file priority, skip', off.getByRole('button'), { color: MUTED, text: 'Не загружать' })
  await m('file progress', cls(on, 'bar'), { h: 2, backgroundColor: SUBTLE })
  verdict(S)
})

test('desktop trackers', async ({ page }) => {
  const S = 'Trackers'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await openMain(page)
  const details = page.locator('[data-details]')
  await details.getByRole('tab', { name: 'Трекеры' }).click()
  await expect(details.getByRole('table')).toBeVisible()
  await shot(page, 'desktop-trackers')

  const add = details.getByRole('button', { name: 'Добавить трекер' })
  await m('add tracker', add, { h: 28, paddingLeft: '10px', columnGap: '6px', borderRadius: '7px', backgroundColor: NONE, color: TEXT2, fontSize: '12px', fontWeight: '400', borderTopColor: BORDER })
  await m('add tracker icon', add.locator('svg'), { w: 13, h: 13 })
  const barY = await details.getByRole('tablist').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return b.y + b.height / 2
  })
  await m('add tracker on the tab line', add, { centerY: barY })
  const table = details.getByRole('table')
  const head = table.getByRole('row').first()
  // the seventh track holds the row menu (spec: removing is in the row's menu)
  await m('head', head, { h: 36, fontSize: '12px', color: MUTED, paddingLeft: '18px', paddingRight: '18px', columnGap: '12px', borderBottomColor: SUBTLE, gridTemplateColumns: '484px 130px 64px 64px 80px 200px 32px' })
  const row = table.getByRole('row').filter({ hasText: 'opentrackr' })
  await m('row', row, { h: 44, paddingLeft: '18px', borderBottomColor: DIVIDER })
  await m('url', cls(row, 'url'), { fontFamily: MONO, fontSize: '12px', color: TEXT })
  await m('url, pseudo', cls(table.getByRole('row').filter({ hasText: 'DHT' }), 'url'), { color: MUTED })
  await m('status, working', cls(row, 'status'), { color: SEED, columnGap: '7px', fontSize: '12.5px' })
  await m('dot', cls(row, 'dot'), { w: 7, h: 7, backgroundColor: SEED })
  const cells = row.getByRole('cell')
  await m('seeds', cells.nth(2), { fontFamily: MONO, fontSize: '12px', textAlign: 'right', color: TEXT, text: '312' })
  await m('peers', cells.nth(3), { fontFamily: MONO, text: '41' })
  await m('downloaded, thousands space', cells.nth(4), { fontFamily: MONO, color: MUTED, text: '18 204' })
  await m('message', cells.nth(5), { fontSize: '12px', color: MUTED })
  await m('status, updating', cls(table.getByRole('row').filter({ hasText: 'demonii' }), 'status'), { color: hex('#FBBF24') })
  await m('status, error', cls(table.getByRole('row').filter({ hasText: 'example.org' }), 'status'), { color: DANGER })
  await m('status, disabled', cls(table.getByRole('row').filter({ hasText: 'LSD' }), 'status'), { color: MUTED })
  verdict(S)
})

test('desktop peers', async ({ page }) => {
  const S = 'Peers'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await openMain(page)
  const details = page.locator('[data-details]')
  await details.getByRole('tab', { name: 'Пиры' }).click()
  await expect(details.getByRole('table')).toBeVisible()
  await shot(page, 'desktop-peers')

  const summary = cls(details, 'summary')
  await m('summary', summary, { fontFamily: MONO, fontSize: '11px', color: MUTED, text: '6 подключено · 41 в рое' })
  const barY = await details.getByRole('tablist').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return b.y + b.height / 2
  })
  await m('summary on the tab line', summary, { centerY: barY })
  const table = details.getByRole('table')
  const head = table.getByRole('row').first()
  await m('head', head, { h: 36, paddingLeft: '18px', columnGap: '12px', fontSize: '12px', color: MUTED, borderBottomColor: SUBTLE, gridTemplateColumns: '210px 342px 160px 96px 96px 90px 60px' })
  const row = table.getByRole('row').nth(4)
  await m('row', row, { h: 44, paddingLeft: '18px', borderBottomColor: DIVIDER })
  await m('flag', cls(row, 'flag'), { w: 20, h: 14, borderRadius: '3px' })
  await m('address cell', cls(row, 'addr'), { columnGap: '10px' })
  await m('ip', cls(row, 'ip'), { fontFamily: MONO, fontSize: '12px', text: '203.0.113.90:6881' })
  await m('client', cls(row, 'client'), { color: TEXT2, fontSize: '12.5px' })
  await m('track', cls(row, 'track'), { h: 10 })
  await m('bar cell', cls(row, 'progress'), { columnGap: '10px' })
  await m('percent', cls(row, 'pct'), { w: 34, fontFamily: MONO, fontSize: '11px', text: '81%' })
  const cells = row.getByRole('cell')
  await m('download', cells.nth(3).locator('span'), { color: ACCENT, fontFamily: MONO, fontSize: '12px', text: '1.60 МБ/с' })
  await m('upload', cells.nth(4).locator('span'), { color: MUTED, text: '410 КБ/с' })
  await m('received', cells.nth(5), { color: MUTED, fontFamily: MONO, text: '207 МБ' })
  await m('flags', cls(row, 'flags'), { fontFamily: MONO, fontSize: '11px', color: MUTED, text: 'D U X' })
  await m('download, idle', table.getByRole('row').nth(6).getByRole('cell').nth(3).locator('span'), { color: DIM, text: '0 Б/с' })
  verdict(S)
})

test('desktop delete', async ({ page }) => {
  const S = 'DeleteDialog'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await openMain(page)
  await page.locator('[data-details]').getByRole('button', { name: 'Удалить' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toBeVisible()
  await shot(page, 'desktop-delete')

  await m('dialog', dlg, { w: 440, h: 260, borderRadius: '16px', backgroundColor: CARD, borderTopColor: BORDER })
  const box = (await dlg.boundingBox())!
  const icon = cls(dlg, 'icon')
  await m('icon', icon, { x: box.x + 21, y: box.y + 21, w: 36, h: 36, borderRadius: '10px', color: DANGER })
  const title = dlg.getByRole('heading')
  await m('title beside the icon', title, { x: box.x + 21 + 36 + 14, y: box.y + 21, fontSize: '16px', fontWeight: '600' })
  await m('text', cls(dlg, 'description'), { color: MUTED, fontSize: '12.5px', lineHeight: '18.75px', x: box.x + 21 + 36 + 14 })
  await m('no close button', dlg.getByRole('button'), { text: 'Отмена' })
  const option = cls(dlg, 'option')
  await m('option', option, { x: box.x + 21, paddingTop: '12px', columnGap: '10px', borderRadius: '10px', backgroundColor: SURFACE, borderTopColor: BORDER, fontSize: '12.5px' })
  await m('checkbox', cls(option, 'box'), { w: 16, h: 16, borderRadius: '4px', borderTopColor: CONTROL })
  await m('size', cls(option, 'size'), { fontFamily: MONO, fontSize: '11px', color: MUTED, text: '2.60 ГБ' })
  await m('cancel', dlg.getByRole('button', { name: 'Отмена' }), { h: 36, paddingLeft: '14px', borderRadius: '9px', fontSize: '12.5px', fontWeight: '500', color: TEXT })
  await m('confirm', dlg.getByRole('button', { name: 'Удалить' }), { h: 36, paddingLeft: '16px', borderRadius: '9px', fontSize: '12.5px', fontWeight: '600', backgroundColor: DANGER_BG, color: hex('#FFFFFF') })
  await m('footer', cls(dlg, 'footer'), { columnGap: '8px', padding: '16px 20px', borderTopWidth: '0px' })
  const confirm = (await dlg.getByRole('button', { name: 'Удалить' }).boundingBox())!
  const below = Math.round(box.y + box.height - (confirm.y + confirm.height))
  rows.push({ screen: S, element: 'confirm to the bottom edge', prop: 'gap', want: 17, got: below, ok: below === 17 })
  verdict(S)
})

test('desktop limits', async ({ page }) => {
  const S = 'SpeedLimits'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await openMain(page)
  await page.locator(`[data-hash="${HASH}"]`).click({ button: 'right', position: { x: 300, y: 10 } })
  await page.getByRole('menuitem', { name: 'Ограничение скорости…' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('radio', { name: 'Для торрента' })).toBeChecked()
  await expect(cls(dlg, 'hint')).toBeVisible()
  await shot(page, 'desktop-limits')

  await m('dialog', dlg, { w: 420, h: 430, borderRadius: '16px', backgroundColor: CARD })
  await m('header', dlg.locator('header'), { padding: '18px 20px 14px', h: 69 })
  await m('title', dlg.getByRole('heading'), { fontSize: '16px', fontWeight: '600' })
  await m('subtitle', cls(dlg, 'description'), { fontSize: '12px', color: MUTED, text: 'Blender 4.3 Splash Assets' })
  await m('close', dlg.getByRole('button', { name: 'Закрыть' }), { w: 32, h: 32, borderRadius: '8px', color: MUTED })
  const seg = dlg.getByRole('radiogroup')
  await m('segmented', seg, { padding: '3px', columnGap: '4px', borderRadius: '9px', backgroundColor: HOVER })
  await m('segment, active', seg.getByRole('radio').nth(0), { h: 30, borderRadius: '7px', backgroundColor: BORDER, color: TEXT, fontWeight: '500', fontSize: '12.5px' })
  await m('segment, idle', seg.getByRole('radio').nth(1), { h: 30, backgroundColor: NONE, color: MUTED, fontWeight: '400' })
  await m('form', cls(dlg, 'form'), { rowGap: '18px' })
  const group = dlg.getByRole('group').nth(1)
  await m('limit block', group, { rowGap: '10px' })
  await m('limit label', cls(group, 'label'), { color: TEXT2, fontSize: '12.5px', columnGap: '8px' })
  await m('arrow, up', cls(group, 'up'), { color: SEED })
  await m('arrow, down', cls(dlg.getByRole('group').nth(0), 'down'), { color: ACCENT })
  await m('field', cls(group, 'field'), { w: 120, h: 34, borderRadius: '8px', paddingLeft: '10px', columnGap: '6px', backgroundColor: BG, borderTopColor: BORDER })
  await m('input', group.getByRole('textbox'), { fontFamily: MONO, fontSize: '13px', textAlign: 'right', color: TEXT })
  await m('unit', cls(group, 'unit'), { fontFamily: MONO, fontSize: '11px', color: MUTED })
  await m('presets', cls(group, 'presets'), { columnGap: '6px' })
  await m('preset, idle', group.locator('[data-preset="1"]'), { h: 28, borderRadius: '7px', fontFamily: MONO, fontSize: '11px', color: MUTED, backgroundColor: NONE, borderTopColor: BORDER })
  await m('preset, active', group.locator('[data-preset="10"]'), { backgroundColor: HOVER, color: ACCENT, borderTopColor: ACCENT })
  const hint = cls(dlg, 'hint')
  await m('hint', hint, { padding: '10px 12px', columnGap: '10px', borderRadius: '10px', backgroundColor: SURFACE, borderTopColor: BORDER, color: MUTED, fontSize: '12px', lineHeight: '17.4px' })
  await m('footer', cls(dlg, 'footer'), { padding: '14px 20px', columnGap: '8px', borderTopColor: SUBTLE, justifyContent: 'flex-end' })
  await m('cancel', dlg.getByRole('button', { name: 'Отмена' }), { h: 36, paddingLeft: '14px', borderRadius: '9px', fontWeight: '500', fontSize: '12.5px' })
  await m('apply', dlg.getByRole('button', { name: 'Применить' }), { h: 36, paddingLeft: '16px', borderRadius: '9px', backgroundColor: ACCENT, color: BG, fontWeight: '600', fontSize: '12.5px' })
  verdict(S)
})

test('desktop add', async ({ page }) => {
  const S = 'AddTorrent'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, DESKTOP, '', { taxonomy: true })
  await page.getByRole('button', { name: 'Добавить торрент' }).click()
  const dlg = page.getByRole('dialog')
  await page.getByTestId('file-input').setInputFiles(sampleTorrent())
  await expect(cls(dlg, 'card')).toBeVisible()
  await cls(dlg, 'trigger').click()
  await page.getByRole('option', { name: 'Софт' }).click()
  await dlg.getByLabel('Теги', { exact: true }).fill('linux')
  await dlg.getByLabel('Теги', { exact: true }).press('Enter')
  await shot(page, 'desktop-add')

  await m('backdrop', page.getByTestId('dialog-backdrop'), { backgroundColor: 'rgba(0, 0, 0, 0.62)' })
  await m('dialog', dlg, { x: 410, y: 64, w: 620, borderRadius: '16px', backgroundColor: CARD, borderTopColor: BORDER, boxShadow: 'rgba(0, 0, 0, 0.5) 0px 24px 64px 0px' })
  await m('header', dlg.locator('header'), { padding: '18px 20px 14px' })
  await m('title', dlg.getByRole('heading'), { fontSize: '16px', fontWeight: '600' })
  await m('form', cls(dlg, 'form'), { rowGap: '16px' })
  const seg = dlg.getByRole('radiogroup')
  await m('segmented', seg, { w: 578, padding: '3px', columnGap: '4px', borderRadius: '9px', backgroundColor: HOVER })
  await m('segment, active', seg.getByRole('radio').nth(0), { h: 30, borderRadius: '7px', backgroundColor: BORDER, color: TEXT, fontWeight: '500' })
  await m('segment, idle', seg.getByRole('radio').nth(1), { fontWeight: '400', color: MUTED })
  await m('drop zone', cls(dlg, 'drop'), { h: 104, borderTopStyle: 'dashed', borderTopColor: NEUTRAL, borderRadius: '12px', rowGap: '8px', color: MUTED })
  await m('drop text', cls(dlg, 'dropText'), { fontSize: '13px', color: TEXT2 })
  await m('drop hint', cls(dlg, 'dropHint'), { fontSize: '11px' })
  const card = cls(dlg, 'card')
  await m('file card', card, { padding: '10px 12px', columnGap: '10px', borderRadius: '10px', backgroundColor: SURFACE, borderTopColor: BORDER })
  await m('file card name', cls(card, 'cardName'), { fontWeight: '500', fontSize: '12.5px' })
  await m('file card meta', cls(card, 'cardMeta'), { fontFamily: MONO, fontSize: '11px', color: MUTED, text: '6.10 ГБ · 4 файла' })
  await m('file card remove', cls(card, 'remove'), { w: 28, h: 28, color: MUTED })
  await m('fields grid', cls(dlg, 'grid'), { columnGap: '12px', rowGap: '12px' })
  const path = dlg.getByRole('textbox', { name: 'Папка сохранения' })
  await m('save path', path.locator('xpath=..'), { h: 36, borderRadius: '9px', paddingLeft: '12px', columnGap: '8px', backgroundColor: BG, borderTopColor: BORDER })
  await m('save path input', path, { fontFamily: MONO, fontSize: '12px' })
  await m('field label', dlg.getByText('Папка сохранения'), { fontSize: '12px', color: MUTED })
  await m('category', cls(dlg, 'trigger'), { h: 36, borderRadius: '9px', paddingLeft: '12px', columnGap: '8px', backgroundColor: BG, fontSize: '12.5px' })
  await m('category dot', cls(cls(dlg, 'trigger'), 'dot'), { w: 8, h: 8, borderRadius: '2px' })
  await m('tags', dlg.getByLabel('Теги', { exact: true }).locator('xpath=..'), { h: 36, borderRadius: '9px', paddingLeft: '6px', columnGap: '6px', backgroundColor: BG })
  await m('tags input', dlg.getByLabel('Теги', { exact: true }), { fontSize: '12.5px' })
  await m('options grid', cls(dlg, 'options'), { rowGap: '10px', columnGap: '16px', color: TEXT2 })
  const opt = cls(dlg, 'options').locator('label')
  await m('option', opt.nth(0), { columnGap: '10px', h: 16 })
  await m('option box, on', cls(opt.nth(0), 'box'), { w: 16, h: 16, borderRadius: '4px', backgroundColor: ACCENT })
  await m('option box, off', cls(opt.nth(1), 'box'), { w: 16, h: 16, backgroundColor: NONE, borderTopColor: CONTROL })
  const files = cls(dlg, 'files')
  await m('files', files, { borderRadius: '10px', borderTopColor: BORDER })
  await m('files head', cls(files, 'filesHead'), { padding: '8px 12px', fontSize: '12px', color: MUTED, borderBottomColor: SUBTLE, text: 'Файлывыбрано 4 из 4' })
  const row = cls(files, 'fileRow').first()
  await m('file row', row, { padding: '7px 12px', columnGap: '10px', h: 29 })
  // the spec's checkbox is 15–16px; the mockup draws 14 here
  await m('file row box', cls(row, 'box'), { w: 15, h: 15 })
  await m('file row size', cls(row, 'size'), { fontFamily: MONO, fontSize: '11px', color: MUTED, text: '6.10 ГБ' })
  await m('file row dir', cls(row, 'dir'), { color: MUTED })
  await m('footer', cls(dlg, 'footer'), { padding: '14px 20px', columnGap: '8px', borderTopColor: SUBTLE })
  await m('free', cls(dlg, 'free'), { fontFamily: MONO, fontSize: '11px', color: MUTED, text: 'Свободно 1.84 ТБ' })
  await m('cancel', dlg.getByRole('button', { name: 'Отмена' }), { h: 36, paddingLeft: '14px', borderRadius: '9px' })
  await m('submit', dlg.getByRole('button', { name: 'Добавить', exact: true }), { h: 36, paddingLeft: '16px', borderRadius: '9px', backgroundColor: ACCENT, color: BG, fontWeight: '600' })
  verdict(S)
})

test('desktop settings', async ({ page }) => {
  const S = 'Settings'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, DESKTOP, '#/settings')
  await expect(page.getByRole('switch').first()).toBeVisible()
  const paused = page.getByRole('switch', { name: 'Добавлять на паузе' })
  await expect(paused).toHaveAttribute('aria-checked', 'false')
  await m('toggle, off', paused, { w: 36, h: 20, backgroundColor: NEUTRAL })
  await m('toggle knob, off', cls(paused, 'knob'), { w: 16, h: 16, backgroundColor: TEXT2 })
  await paused.click()
  await expect(paused).toHaveAttribute('aria-checked', 'true')
  await shot(page, 'desktop-settings')

  const side = page.locator('aside')
  // spec over mockup: the sidebar keeps the speed card and its switch on settings; the mockup draws none
  await m('speed card stays', cls(side, 'card'), { padding: '14px', borderRadius: '12px', backgroundColor: CARD })
  await m('alt switch stays', page.getByRole('switch', { name: 'Альт. лимиты' }), { w: 36, h: 20 })
  await m('settings item, active', side.getByRole('button', { name: 'Настройки' }), { h: 38, backgroundColor: HOVER, color: TEXT, fontSize: '13px' })
  await m('filter, idle', side.getByRole('navigation').getByRole('button').first(), { backgroundColor: NONE, color: TEXT2 })
  await m('title', page.getByRole('heading', { level: 1 }), { x: 260, fontSize: '18px', fontWeight: '600', letterSpacing: '-0.18px' })
  const pg = cls(page, 'page').first()
  await m('page', pg, { paddingTop: '20px', paddingLeft: '24px', paddingBottom: '28px', rowGap: '18px', x: 236 })
  await m('head', cls(pg, 'head'), { columnGap: '12px' })
  await m('dirty', cls(pg, 'dirty'), { fontSize: '12px', color: MUTED })
  await m('reset', page.getByRole('button', { name: 'Сбросить' }), { h: 36, paddingLeft: '14px', borderRadius: '9px', fontSize: '12.5px', fontWeight: '500' })
  await m('save', page.getByRole('button', { name: 'Сохранить' }), { h: 36, paddingLeft: '16px', borderRadius: '9px', backgroundColor: ACCENT, color: BG, fontWeight: '600', fontSize: '12.5px' })
  const nav = page.getByRole('navigation', { name: 'Разделы настроек' })
  await m('section nav', nav, { w: 190, rowGap: '2px' })
  await m('section, active', nav.getByRole('button').nth(0), { h: 34, paddingLeft: '12px', borderRadius: '8px', backgroundColor: HOVER, color: TEXT, fontSize: '13px', textAlign: 'left' })
  await m('section, idle', nav.getByRole('button').nth(1), { backgroundColor: NONE, color: MUTED })
  const cards = cls(pg, 'cards')
  await m('cards', cards, { rowGap: '16px', x: 470, w: 760 })
  const card = cls(cards, 'card').first()
  await m('card', card, { borderRadius: '12px', backgroundColor: CARD, borderTopColor: BORDER })
  await m('card head', cls(card, 'cardHead'), { padding: '14px 18px', rowGap: '2px', borderBottomColor: SUBTLE })
  await m('card title', card.getByRole('heading'), { fontSize: '14px', fontWeight: '600' })
  await m('card description', cls(card, 'cardDesc'), { fontSize: '12px', color: MUTED })
  const row = cls(card, 'row').first()
  await m('row', row, { padding: '12px 18px', columnGap: '16px', borderBottomColor: DIVIDER })
  await m('row label', cls(row, 'label'), { fontSize: '13px' })
  await m('row hint', cls(row, 'hint'), { fontSize: '11.5px', color: MUTED })
  await m('text field', cls(row, 'frame'), { w: 260, h: 34, borderRadius: '8px', paddingLeft: '10px', backgroundColor: BG, borderTopColor: BORDER })
  await m('text input', cls(row, 'input'), { fontFamily: MONO, fontSize: '12px' })
  const toggle = page.getByRole('switch', { name: 'Добавлять на паузе' })
  await m('toggle', toggle, { w: 36, h: 20, backgroundColor: ACCENT })
  await m('toggle knob', cls(toggle, 'knob'), { w: 16, h: 16, backgroundColor: BG })
  await nav.getByRole('button', { name: 'Скорость' }).click()
  const limit = page.getByRole('textbox', { name: /отдач/i }).first()
  await m('number field', limit.locator('xpath=..'), { w: 160, h: 34 })
  await m('number input', limit, { fontFamily: MONO, fontSize: '12px' })
  await m('unit', cls(limit.locator('xpath=..'), 'unit'), { fontFamily: MONO, fontSize: '11px', color: MUTED })
  verdict(S)
})

test('desktop login', async ({ page }) => {
  const S = 'Login'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, DESKTOP, '', { signedOut: true })
  await page.getByLabel('Логин').fill('admin')
  await page.getByLabel('Пароль', { exact: true }).fill('hunter2hunter')
  await page.getByRole('button', { name: 'Войти' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await shot(page, 'desktop-login')

  const form = page.getByRole('form')
  await m('card', form, { x: 540, w: 360, padding: '28px', borderRadius: '16px', backgroundColor: CARD, borderTopColor: BORDER, rowGap: '20px' })
  await m('logo', cls(form, 'logo'), { w: 40, h: 40, borderRadius: '11px', backgroundColor: ACCENT, color: BG })
  await m('title', form.getByRole('heading'), { fontSize: '18px', fontWeight: '600', letterSpacing: '-0.18px' })
  await m('host', cls(form, 'host'), { fontFamily: MONO, fontSize: '12px', color: MUTED })
  await m('fields', cls(form, 'fields'), { rowGap: '12px' })
  await m('label', page.getByText('Логин'), { fontSize: '12px', color: MUTED })
  const user = page.getByLabel('Логин')
  await m('login field', user.locator('xpath=..'), { h: 40, borderRadius: '10px', paddingLeft: '12px', backgroundColor: BG, borderTopColor: BORDER })
  await m('login input', user, { fontSize: '14px', color: TEXT })
  const pass = page.getByLabel('Пароль', { exact: true })
  await m('password field', pass.locator('xpath=..'), { h: 40, paddingLeft: '12px', paddingRight: '4px', columnGap: '8px' })
  await m('password input', pass, { fontSize: '14px', letterSpacing: '1.4px' })
  await m('show password', page.getByRole('button', { name: 'Показать пароль' }), { w: 32, h: 32, color: MUTED })
  await m('error', alert, { padding: '10px 12px', columnGap: '10px', borderRadius: '10px', fontSize: '12px', lineHeight: '17.4px', color: DANGER_TEXT })
  await m('error icon', alert.locator('svg'), { w: 15, h: 15 })
  await m('submit', page.getByRole('button', { name: 'Войти' }), { h: 42, borderRadius: '10px', backgroundColor: ACCENT, color: BG, fontSize: '14px', fontWeight: '600' })
  await m('footer', cls(page, 'footer'), { fontFamily: MONO, fontSize: '11px', color: MUTED })
  verdict(S)
})

test('mobile list', async ({ page }) => {
  const S = 'Mobile'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, MOBILE, '')
  const row = page.locator(`a[data-hash="${HASH}"]`)
  await expect(row).toBeVisible()
  await shot(page, 'mobile-list')

  const header = page.locator('header')
  await m('header', header, { padding: '16px 16px 12px', rowGap: '14px' })
  await m('top', cls(header, 'top'), { columnGap: '10px' })
  await m('logo', cls(header, 'logo'), { w: 28, h: 28, borderRadius: '8px' })
  await m('name', cls(header, 'name'), { fontSize: '17px', fontWeight: '600' })
  await m('speeds', cls(header, 'speeds'), { fontFamily: MONO, fontSize: '11px', lineHeight: '15.4px', color: MUTED })
  await m('speed down', cls(header, 'down'), { color: ACCENT, text: '↓ 21.7 МБ/с' })
  // spec: tap zones ≥ 44px; the mockup draws 40
  await m('alt button', cls(header, 'alt'), { w: 44, h: 44, borderRadius: '10px', backgroundColor: CARD, color: TEXT2, borderTopColor: BORDER })
  // spec: ≥ 44px and 16px; the mockup draws 42 and 14
  await m('search', cls(header, 'search'), { h: 44, borderRadius: '12px', backgroundColor: CARD, columnGap: '10px', paddingLeft: '12px' })
  await m('search input', page.getByRole('textbox'), { fontSize: '16px' })
  const chips = cls(header, 'chips')
  await m('chips', chips, { columnGap: '6px' })
  await m('chip, active', cls(chips, 'chip').nth(0), { h: 32, paddingLeft: '12px', columnGap: '6px', borderRadius: '8px', borderTopColor: ACCENT, backgroundColor: HOVER, color: TEXT, fontSize: '13px' })
  await m('chip, idle', cls(chips, 'chip').nth(1), { borderTopColor: BORDER, backgroundColor: NONE, color: TEXT2 })
  await m('chip count, active', cls(cls(chips, 'chip').nth(0), 'count'), { fontFamily: MONO, fontSize: '11px', color: ACCENT })
  await m('chip count, idle', cls(cls(chips, 'chip').nth(1), 'count'), { color: MUTED })
  const list = page.getByRole('list').locator('xpath=ancestor::*[contains(@class, "_card_")]')
  await m('list card', list, { x: 12, w: 366, borderTopLeftRadius: '14px', borderBottomLeftRadius: '0px', backgroundColor: CARD, borderTopColor: BORDER, borderBottomWidth: '0px' })
  await m('row', row, { h: 87, padding: '13px 14px 13px 6px', columnGap: '10px', borderBottomColor: DIVIDER })
  await m('row icon', cls(row, 'icon'), { w: 32, h: 32, color: ACCENT })
  await m('row icon svg', cls(row, 'icon').locator('svg'), { w: 15, h: 15 })
  await m('row name', cls(row, 'name'), { fontSize: '14px', fontWeight: '500' })
  await m('row body', cls(row, 'body'), { rowGap: '6px', paddingTop: '2px' })
  await m('row bar', row.getByRole('progressbar'), { h: 10 })
  await m('row percent', cls(row, 'pct'), { w: 36, fontFamily: MONO, fontSize: '11px', fontWeight: '500' })
  await m('row foot', cls(row, 'foot'), { fontSize: '12px', color: MUTED, columnGap: '8px' })
  await m('row meta', cls(row, 'meta'), { fontFamily: MONO, fontSize: '11px', text: '↓ 12.1 МБ/с · 8 мин' })
  const footer = page.locator('footer')
  await m('footer', footer, { padding: '10px 16px 30px', columnGap: '8px', borderTopColor: BORDER, backgroundColor: SURFACE })
  await m('add', cls(footer, 'add'), { h: 46, borderRadius: '12px', backgroundColor: ACCENT, color: BG, fontSize: '14px', fontWeight: '600', columnGap: '8px' })
  await m('square', cls(footer, 'square'), { w: 46, h: 46, borderRadius: '12px', backgroundColor: CARD, color: TEXT, borderTopColor: BORDER })
  verdict(S)
})

test('mobile torrent', async ({ page }) => {
  const S = 'MobileDetail'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, MOBILE, `#/torrent/${HASH}`)
  await expect(page.locator('[data-kind="file"]').first()).toBeVisible()
  await shot(page, 'mobile-torrent')

  const bar = cls(page, 'bar').first()
  await m('bar', bar, { padding: '8px 8px 4px', columnGap: '4px' })
  await m('back', page.getByRole('button', { name: 'Назад' }), { w: 44, h: 44, color: TEXT2 })
  await m('bar title', cls(bar, 'barTitle'), { fontSize: '15px', fontWeight: '500', color: MUTED })
  await m('move', page.getByRole('button', { name: 'Переместить' }), { w: 44, h: 44, color: MUTED })
  await m('delete', page.getByRole('button', { name: 'Удалить' }), { w: 44, h: 44, color: DANGER })
  const top = cls(page, 'top')
  await m('top', top, { columnGap: '14px', alignItems: 'center' })
  await m('piece map', cls(top, 'map'), { w: 72, h: 72 })
  await m('name', page.getByRole('heading'), { fontSize: '18px', fontWeight: '600', lineHeight: '23.4px' })
  await m('chips', cls(top, 'chips'), { columnGap: '5px' })
  await m('chip, status', cls(top, 'chips').locator('> *').nth(0), { h: 21, paddingLeft: '8px', backgroundColor: ACCENT, color: BG, fontSize: '11px', fontWeight: '600' })
  await m('chip', cls(top, 'chips').locator('> *').nth(1), { h: 21, paddingLeft: '8px', backgroundColor: CHIP, color: TEXT2, fontSize: '11px', fontWeight: '400', text: '54 пира' })
  const card = cls(page, 'card').first()
  await m('progress card', card, { padding: '14px', rowGap: '12px', borderRadius: '14px', backgroundColor: CARD, borderTopColor: BORDER })
  await m('bar fill', card.getByRole('progressbar'), { h: 14 })
  await m('percent', cls(card, 'percent'), { fontSize: '22px', fontWeight: '600', letterSpacing: '-0.44px' })
  await m('stats', cls(card, 'stats'), { rowGap: '10px', columnGap: '10px' })
  await m('stat key', card.locator('dt').first(), { fontSize: '11px', color: MUTED })
  await m('stat value', card.locator('dd').first(), { fontFamily: MONO, fontSize: '13px', fontWeight: '500', text: '12.1 МБ/с' })
  const tablist = page.getByRole('tablist')
  await m('tabs', tablist, { columnGap: '2px', borderBottomColor: SUBTLE })
  // spec: tap zones ≥ 44px; the mockup draws 40
  await m('tab, active', tablist.getByRole('tab').nth(0), { h: 44, paddingLeft: '10px', fontWeight: '500', color: TEXT, borderBottomColor: ACCENT, fontSize: '13px' })
  await m('tab, idle', tablist.getByRole('tab').nth(1), { fontWeight: '400', color: MUTED })
  const row = page.locator('[data-kind="file"]').filter({ hasText: 'splash_scene.blend' })
  await m('file row', row, { columnGap: '12px', paddingTop: '12px', alignItems: 'flex-start' })
  await m('file checkbox', cls(row, 'box'), { w: 16, h: 16, borderRadius: '4px', backgroundColor: ACCENT })
  await m('file checkbox tap zone', cls(row, 'check'), { h: 44 })
  await m('file name', cls(row, 'name'), { fontSize: '14px' })
  await m('file size', cls(row, 'size'), { fontFamily: MONO, fontSize: '11px', color: MUTED, text: '2.90 ГБ' })
  await m('file text', cls(row, 'text'), { rowGap: '3px' })
  // spec: tap zones ≥ 44px; the mockup draws 30
  await m('file priority', cls(row, 'prio').first(), { h: 44, borderRadius: '8px', fontSize: '12px', paddingLeft: '10px', paddingRight: '8px', color: ACCENT, text: 'Макс.' })
  await m('file progress', cls(row, 'bar'), { h: 2 })
  const footer = cls(page, 'footer')
  await m('footer', footer, { padding: '10px 16px 30px', borderTopColor: BORDER, backgroundColor: SURFACE })
  await m('pause', cls(footer, 'toggle'), { h: 46, borderRadius: '12px', backgroundColor: CARD, color: TEXT, fontSize: '14px', fontWeight: '500', columnGap: '8px', borderTopColor: BORDER })
  verdict(S)
})

test('mobile add', async ({ page }) => {
  const S = 'MobileAdd'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, MOBILE, '', { taxonomy: true })
  await page.getByRole('button', { name: 'Добавить magnet' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toBeVisible()
  await dlg.getByRole('textbox', { name: 'Magnet-ссылки' }).fill('magnet:?xt=urn:btih:a3f9c2d17be05f4c9e8a2b6d0c1f73e98e41d0&dn=archlinux-2026.11.01')
  await cls(dlg, 'trigger').click()
  await page.getByRole('option', { name: 'Софт' }).click()
  await shot(page, 'mobile-add')

  await m('sheet', dlg, { borderTopLeftRadius: '18px', borderTopColor: BORDER, borderLeftWidth: '0px', backgroundColor: CARD, w: 390 })
  const title = dlg.getByRole('heading')
  await m('title', title, { x: 16, fontSize: '17px', fontWeight: '600' })
  const sheetBox = (await dlg.boundingBox())!
  await m('title under the grabber', title, { y: sheetBox.y + 1 + 26 })
  const seg = dlg.getByRole('radiogroup')
  await m('segmented', seg, { x: 16, w: 358, padding: '3px', columnGap: '4px', borderRadius: '10px', backgroundColor: HOVER })
  await m('segment, active', seg.getByRole('radio').nth(1), { borderRadius: '8px', backgroundColor: BORDER, color: TEXT, fontWeight: '500', fontSize: '13px' })
  await m('segment, idle', seg.getByRole('radio').nth(0), { w: 174, backgroundColor: NONE, color: MUTED, fontWeight: '400' })
  await m('form', cls(dlg, 'form'), { rowGap: '16px' })
  await m('magnet block', cls(dlg, 'magnet'), { rowGap: '6px' })
  await m('magnet label', cls(cls(dlg, 'magnet'), 'label'), { fontSize: '12px', color: MUTED })
  // spec: inputs ≥ 16px; the mockup draws 12
  await m('magnet', dlg.getByRole('textbox', { name: 'Magnet-ссылки' }), { h: 76, padding: '10px 12px', borderRadius: '10px', backgroundColor: BG, fontFamily: MONO, fontSize: '16px' })
  const path = dlg.getByRole('textbox', { name: 'Папка сохранения' })
  await m('save path', path.locator('xpath=..'), { h: 44, borderRadius: '10px', paddingLeft: '12px', columnGap: '8px', backgroundColor: BG })
  await m('save path input', path, { fontFamily: MONO, fontSize: '16px' })
  const cat = cls(dlg, 'trigger')
  await m('category', cat, { h: 44, borderRadius: '10px', paddingRight: '12px', columnGap: '8px', backgroundColor: BG, fontSize: '13px', justifyContent: 'flex-end' })
  const catBox = (await cat.boundingBox())!
  await m('category label inside the button', cls(cls(dlg, 'root'), 'label'), { x: catBox.x + 13, fontSize: '12px', color: MUTED })
  await m('options', cls(dlg, 'options'), { borderRadius: '12px', borderTopColor: BORDER })
  await m('option', cls(dlg, 'option').first(), { h: 48, columnGap: '12px', paddingLeft: '12px' })
  const toggle = dlg.getByRole('switch', { name: 'Запустить сразу' })
  await m('toggle zone', toggle, { w: 44, h: 44 })
  await m('footer', cls(dlg, 'footer'), { padding: '12px 16px 30px', columnGap: '8px', borderTopColor: SUBTLE })
  await m('cancel', cls(dlg, 'cancel'), { h: 48, paddingLeft: '18px', borderRadius: '12px', fontSize: '14px', fontWeight: '500', color: TEXT, borderTopColor: BORDER })
  await m('submit', cls(dlg, 'submit'), { h: 48, borderRadius: '12px', backgroundColor: ACCENT, color: BG, fontSize: '15px', fontWeight: '600' })
  verdict(S)
})

test('mobile settings', async ({ page }) => {
  const S = 'MobileSettings'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, MOBILE, '#/settings')
  await expect(page.getByRole('switch').first()).toBeVisible()
  await shot(page, 'mobile-settings')

  await m('bar', cls(page, 'bar'), { padding: '8px 8px 4px', columnGap: '4px' })
  await m('back', page.getByRole('button', { name: 'Назад' }), { w: 44, h: 44, color: TEXT2 })
  await m('title', page.getByRole('heading', { level: 1 }), { fontSize: '17px', fontWeight: '600' })
  await m('save', page.getByRole('button', { name: 'Сохранить' }), { h: 44, paddingLeft: '12px', fontSize: '14px', fontWeight: '600' })
  const scroll = cls(page, 'scroll')
  await m('scroll', scroll, { paddingTop: '8px', paddingLeft: '16px' })
  await m('groups', cls(scroll, 'groups'), { rowGap: '18px' })
  const group = cls(scroll, 'group').first()
  await m('group', group, { rowGap: '8px' })
  await m('group title', cls(group, 'groupTitle'), { paddingLeft: '4px', fontSize: '11px', fontWeight: '500', letterSpacing: '0.88px', textTransform: 'uppercase', color: MUTED })
  await m('list', cls(group, 'list'), { borderRadius: '12px', backgroundColor: CARD, borderTopColor: BORDER })
  const item = cls(group, 'item').first()
  await m('value row', item, { h: 48, paddingLeft: '14px', columnGap: '12px', borderBottomColor: DIVIDER, fontSize: '13px' })
  await m('value', cls(item, 'value'), { fontFamily: MONO, fontSize: '12px', color: MUTED, text: '/downloads' })
  await m('chevron', item.locator('svg'), { w: 14, h: 14, color: MUTED })
  const toggle = page.getByRole('switch').first()
  await m('toggle zone', toggle, { w: 44, h: 44 })
  verdict(S)
})

test('mobile login', async ({ page }) => {
  const S = 'MobileLogin'
  const m = (el: string, at: Locator, want: Want) => measure(S, el, at, want)
  await open(page, MOBILE, '', { signedOut: true })
  await expect(page.getByRole('form')).toBeVisible()
  await page.getByLabel('Логин').fill('admin')
  await shot(page, 'mobile-login')

  const form = page.getByRole('form')
  await m('page', cls(page, 'page'), { paddingTop: '16px', paddingBottom: '24px', paddingLeft: '16px', rowGap: '18px' })
  await m('card', form, { w: 358, padding: '24px 20px', borderRadius: '16px', rowGap: '20px' })
  await m('logo', cls(form, 'logo'), { w: 40, h: 40, borderRadius: '11px' })
  await m('title', form.getByRole('heading'), { fontSize: '18px', fontWeight: '600' })
  await m('host', cls(form, 'host'), { fontFamily: MONO, fontSize: '12px', color: MUTED })
  const user = page.getByLabel('Логин')
  await m('login field', user.locator('xpath=..'), { h: 44, borderRadius: '10px', paddingLeft: '12px' })
  await m('login input', user, { fontSize: '16px' })
  const pass = page.getByLabel('Пароль', { exact: true })
  await m('password field', pass.locator('xpath=..'), { h: 44, paddingLeft: '12px', paddingRight: '0px', columnGap: '4px' })
  await m('password input', pass, { fontSize: '16px', letterSpacing: 'normal' })
  await m('show password', page.getByRole('button', { name: 'Показать пароль' }), { w: 44 })
  await m('submit', page.getByRole('button', { name: 'Войти' }), { h: 46, borderRadius: '10px', fontSize: '15px', fontWeight: '600' })
  await m('footer', cls(page, 'footer'), { fontFamily: MONO, fontSize: '11px', color: MUTED })
  verdict(S)
})

// Not in the mockups, but built on the same Dialog: only looked at.
test('other dialogs', async ({ page }) => {
  await openMain(page)
  await page.locator('[data-details]').getByRole('button', { name: 'Переместить' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, 'desktop-move')
  await page.keyboard.press('Escape')
  await open(page, MOBILE, `#/torrent/${HASH}`)
  await page.getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, 'mobile-delete')
  await page.keyboard.press('Escape')
  await page.goto('/#/settings')
  await page.getByRole('button', { name: /Лимит отдачи/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, 'mobile-setting-sheet')
})
