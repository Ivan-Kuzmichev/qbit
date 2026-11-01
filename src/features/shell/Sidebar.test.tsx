// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerState, Torrent } from '../../api/types'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { stubFetch, text } from '../../test/fetchStub'
import { Sidebar } from './Sidebar'
import { Sparkline } from './Sparkline'

const tor = (state: string, extra: Partial<Torrent> = {}): Torrent =>
  ({ hash: `${state}-${Math.random()}`, state, progress: 0.5, category: '', tags: '', ...extra }) as Torrent

function load(list: Torrent[], extra: { categories?: string[]; tags?: string[]; server?: Partial<ServerState> } = {}) {
  useTorrents.setState({
    ...emptySync,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    categories: Object.fromEntries((extra.categories ?? []).map((n) => [n, { name: n, savePath: '' }])),
    tags: extra.tags ?? [],
    server: { dl_info_speed: 0, up_info_speed: 0, dl_rate_limit: 0, use_alt_speed_limits: false, ...extra.server } as ServerState,
  })
}

beforeEach(() => {
  location.hash = ''
  useUi.setState({ filter: { type: 'status', value: 'all' } })
})
afterEach(() => {
  useTorrents.setState({ ...emptySync, speedHistory: [] })
  vi.unstubAllGlobals()
})

const filters = () => screen.getByRole('navigation', { name: 'Фильтры' })

describe('Sidebar filters', () => {
  it('shows counts from the filter table', () => {
    load([tor('downloading'), tor('stalledDL'), tor('uploading'), tor('stoppedUP'), tor('stoppedDL'), tor('checkingDL')])
    render(<Sidebar />)
    const count = (name: string) => within(screen.getByRole('button', { name: new RegExp(`^${name}`) })).getByText(/^\d+$/).textContent
    expect(count('Все')).toBe('6')
    expect(count('Загрузка')).toBe('2')
    expect(count('Раздача')).toBe('1')
    expect(count('Завершено')).toBe('1')
    expect(count('Пауза')).toBe('1')
  })
  it('hides "В очереди" and "Ошибка" at zero, shows them when present', () => {
    load([tor('downloading')])
    const { unmount } = render(<Sidebar />)
    expect(within(filters()).queryByText('В очереди')).toBeNull()
    expect(within(filters()).queryByText('Ошибка')).toBeNull()
    unmount()
    load([tor('queuedDL'), tor('error')])
    render(<Sidebar />)
    expect(within(filters()).getByText('В очереди')).toBeInTheDocument()
    expect(within(filters()).getByText('Ошибка')).toBeInTheDocument()
  })
  it('clicking a filter updates the ui store; active one has aria-current', async () => {
    load([tor('downloading')])
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /^Все/ })).toHaveAttribute('aria-current', 'true')
    await userEvent.click(screen.getByRole('button', { name: /^Загрузка/ }))
    expect(useUi.getState().filter).toEqual({ type: 'status', value: 'downloading' })
  })
  it('categories and tags groups are hidden without data', () => {
    load([tor('downloading')])
    render(<Sidebar />)
    expect(screen.queryByText('Категории')).toBeNull()
    expect(screen.queryByText('Теги')).toBeNull()
  })
  it('categories and tags show counts, filter, and collapse', async () => {
    load([tor('downloading', { category: 'Movies', tags: 'hd' }), tor('stoppedDL')], {
      categories: ['Movies', 'Empty'],
      tags: ['hd'],
    })
    render(<Sidebar />)
    const movies = screen.getByRole('button', { name: /^Movies/ })
    expect(within(movies).getByText('1')).toBeInTheDocument()
    await userEvent.click(movies)
    expect(useUi.getState().filter).toEqual({ type: 'category', value: 'Movies' })
    await userEvent.click(screen.getByRole('button', { name: /^hd/ }))
    expect(useUi.getState().filter).toEqual({ type: 'tag', value: 'hd' })
    const head = screen.getByRole('button', { name: 'Категории' })
    expect(head).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /^Movies/ })).toBeNull()
  })
  it('Settings item navigates and is marked current on #/settings', async () => {
    load([])
    render(<Sidebar />)
    await userEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    expect(location.hash).toBe('#/settings')
    expect(await screen.findByRole('button', { name: 'Настройки' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /^Все/ })).not.toHaveAttribute('aria-current')
  })
})

describe('SpeedCard in Sidebar', () => {
  it('shows the limit from dl_rate_limit', () => {
    load([], { server: { dl_info_speed: 22756000, up_info_speed: 3250000, dl_rate_limit: 5 * 1024 * 1024 } })
    render(<Sidebar />)
    expect(screen.getByText('21.7')).toBeInTheDocument()
    expect(screen.getAllByText('МБ/с').length).toBeGreaterThan(0)
    expect(screen.getByText('лимит 5 МБ/с')).toBeInTheDocument()
  })
  it('the speed button names the speeds for assistive tech', () => {
    load([], { server: { dl_info_speed: 22756000, up_info_speed: 3250000, dl_rate_limit: 5 * 1024 * 1024 } })
    render(<Sidebar />)
    const name = screen.getByRole('button', { name: /Скорость и лимиты/ }).getAttribute('aria-label')!
    expect(name).toContain('21.7 МБ/с')
    expect(name).toContain('3.10 МБ/с')
    expect(name).toContain('лимит 5 МБ/с')
  })
  it('zero limit shows the no-limit caption', () => {
    load([], { server: { dl_rate_limit: 0 } })
    render(<Sidebar />)
    expect(screen.getByText('без лимита')).toBeInTheDocument()
  })
  it('the alt limits switch calls transfer/toggleSpeedLimitsMode', async () => {
    load([], { server: { use_alt_speed_limits: false } })
    const fetchMock = stubFetch({
      'transfer/toggleSpeedLimitsMode': () => text(''),
      'sync/maindata': () => text('', 500),
    })
    render(<Sidebar />)
    const sw = screen.getByRole('switch', { name: 'Альт. лимиты' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('transfer/toggleSpeedLimitsMode') && i?.method === 'POST')).toBe(true)
  })
  it('switch reflects use_alt_speed_limits', () => {
    load([], { server: { use_alt_speed_limits: true } })
    render(<Sidebar />)
    expect(screen.getByRole('switch', { name: 'Альт. лимиты' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Sparkline', () => {
  const poly = (c: HTMLElement) => c.querySelector('polyline')
  it('renders an empty svg with fewer than 2 points', () => {
    for (const pts of [[], [1]]) {
      const { container, unmount } = render(<Sparkline values={pts} />)
      expect(container.querySelector('svg')).not.toBeNull()
      expect(poly(container)).toBeNull()
      unmount()
    }
  })
  it('draws one point per value for any length', () => {
    for (const n of [2, 7, 60]) {
      const { container, unmount } = render(<Sparkline values={Array.from({ length: n }, (_, i) => i)} />)
      expect(poly(container)!.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(n)
      unmount()
    }
  })
  it('all zeros gives finite coordinates', () => {
    const { container } = render(<Sparkline values={[0, 0, 0]} />)
    expect(poly(container)!.getAttribute('points')).not.toMatch(/NaN|Infinity/)
  })
})

describe('SpeedCard opens the limits dialog', () => {
  it('a click on the speed area opens the global tab; the switch does not', async () => {
    const { useDialogs } = await import('../../store/dialogs')
    useDialogs.setState({ open: null })
    stubFetch({ 'transfer/toggleSpeedLimitsMode': () => text(''), 'sync/maindata': () => text('', 500) })
    load([], { server: { dl_info_speed: 1000 } })
    render(<Sidebar />)
    await userEvent.click(screen.getByRole('switch', { name: 'Альт. лимиты' }))
    expect(useDialogs.getState().open).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Скорость и лимиты/ }))
    expect(useDialogs.getState().open).toMatchObject({ kind: 'limits', tab: 'global' })
  })

  it('does not nest the switch inside another button', () => {
    load([], {})
    render(<Sidebar />)
    expect(screen.getByRole('switch', { name: 'Альт. лимиты' }).closest('button:not([role="switch"])')).toBeNull()
  })
})
