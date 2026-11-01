import type { Page } from '@playwright/test'
import { expect, test, type Qb } from './fixtures'

test.skip(({ isMobile }) => isMobile, 'the desktop table; long tasks are measured in Chromium only')

const COUNT = 1000
const UPDATES_PER_SECOND = 50
const TASK_LIMIT_MS = 100

const hashOf = (i: number) => i.toString(16).padStart(40, '0')

function torrent(i: number, tick: number) {
  const progress = ((i * 7 + tick * 13) % 100) / 100
  return {
    name: `Perf torrent ${String(i).padStart(4, '0')}`,
    state: i % 3 === 0 ? 'downloading' : i % 3 === 1 ? 'stalledUP' : 'stoppedDL',
    progress,
    size: 1024 ** 3 + i * 1024,
    completed: Math.floor((1024 ** 3 + i * 1024) * progress),
    dlspeed: i % 3 === 0 ? 1024 * 1024 + tick * 1000 : 0,
    upspeed: 0,
    eta: 3600,
    added_on: 1_700_000_000 + i,
    ratio: 1,
    priority: i + 1,
    category: '',
    tags: '',
    num_seeds: 1,
    num_leechs: 1,
    num_complete: 1,
    num_incomplete: 1,
    uploaded: 0,
    seq_dl: false,
    f_l_piece_prio: false,
    magnet_uri: '',
  }
}

/** Replaces sync/maindata: a full snapshot of 1000 torrents, then 50 changed torrents per second. */
async function fakeMaindata(page: Page) {
  let rid = 0
  await page.route('**/api/v2/sync/maindata*', (route) => {
    rid++
    if (rid === 1) {
      const torrents = Object.fromEntries(Array.from({ length: COUNT }, (_, i) => [hashOf(i), torrent(i, 0)]))
      return route.fulfill({ json: { rid, full_update: true, torrents, categories: {}, tags: [], server_state: { dl_info_speed: 1, up_info_speed: 1 } } })
    }
    // a moving window of 50 torrents per response; the poller asks once a second
    const start = (rid * UPDATES_PER_SECOND) % COUNT
    const torrents = Object.fromEntries(
      Array.from({ length: UPDATES_PER_SECOND }, (_, k) => {
        const i = (start + k) % COUNT
        const t = torrent(i, rid)
        return [hashOf(i), { progress: t.progress, completed: t.completed, dlspeed: t.dlspeed }]
      }),
    )
    return route.fulfill({ json: { rid, torrents } })
  })
}

async function openSignedIn(page: Page, qb: Qb) {
  await page.context().addCookies(await qb.cookies())
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks: number[] }
    w.__longTasks = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__longTasks.push(e.duration)
    }).observe({ type: 'longtask', buffered: true })
  })
  await fakeMaindata(page)
  await page.goto('/')
}

test.describe('performance: 1000 torrents', () => {
  test('renders a window of rows, keeps up with 50 updates a second and scrolls without long tasks', async ({ page, qb }, info) => {
    await openSignedIn(page, qb)
    const grid = page.getByRole('grid')
    await expect(grid.getByRole('row').nth(1)).toBeVisible({ timeout: 15_000 })
    await expect(grid).toHaveAttribute('aria-rowcount', String(COUNT + 1))

    // 1. the DOM holds a window, not the list
    expect(await page.locator('[role="row"]').count()).toBeLessThan(60)

    // let the first render and the first updates settle, then measure only what the user does next
    await page.waitForTimeout(2500)
    // the observer must be able to see a long task at all: block the page for 150 ms on purpose
    await page.evaluate(() => {
      // as a timer task: a task started by the devtools protocol itself is not reported as a long task
      setTimeout(() => {
        const end = performance.now() + 150
        while (performance.now() < end) {
          /* busy wait */
        }
      }, 0)
    })
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks.some((d) => d >= 100)))
      .toBe(true)
    await page.evaluate(() => {
      ;(window as unknown as { __longTasks: number[] }).__longTasks.length = 0
    })

    // 2. scroll for five seconds while updates keep arriving
    const box = (await grid.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 200)
    for (let i = 0; i < 25; i++) {
      await page.mouse.wheel(0, i < 15 ? 1200 : -900)
      await page.waitForTimeout(200)
      expect(await page.locator('[role="row"]').count()).toBeLessThan(60)
    }

    const tasks = await page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks)
    const worst = Math.max(0, ...tasks)
    info.annotations.push({ type: 'longtasks', description: `count=${tasks.length} worst=${worst.toFixed(0)}ms` })
    console.log(`long tasks while scrolling: count=${tasks.length} worst=${worst.toFixed(0)}ms`)
    expect(worst).toBeLessThanOrEqual(TASK_LIMIT_MS)
  })

  test('keyboard: the focused row follows the arrows and stays visible under the sticky header', async ({ page, qb }) => {
    await openSignedIn(page, qb)
    const grid = page.getByRole('grid')
    await expect(grid.getByRole('row').nth(1)).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press('ArrowDown')
    for (let i = 0; i < 59; i++) await page.keyboard.press('ArrowDown')
    const row = page.locator('[role="row"][aria-selected="true"]')
    await expect(row).toHaveCount(1)
    await expect(row).toBeFocused()
    await expect(row).toContainText('Perf torrent 0940')

    const fit = await page.evaluate(() => {
      const r = document.activeElement!.getBoundingClientRect()
      const header = document.querySelector('[role="columnheader"]')!.closest('[role="row"]')!.getBoundingClientRect()
      const scroller = document.querySelector('[role="grid"]')!.parentElement!.getBoundingClientRect()
      return { belowHeader: r.top >= header.bottom - 1, aboveEnd: r.bottom <= scroller.bottom + 1 }
    })
    expect(fit).toEqual({ belowHeader: true, aboveEnd: true })

    // and back up
    for (let i = 0; i < 59; i++) await page.keyboard.press('ArrowUp')
    await expect(row).toContainText('Perf torrent 0999')
    await expect(row).toBeFocused()
  })
})
