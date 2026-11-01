// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { TopBar } from './TopBar'
import { TorrentTable } from './TorrentTable'

const progressRenders = vi.hoisted(() => ({ count: 0 }))
vi.mock('../../components/ui/Progress', () => ({
  Progress: ({ value }: { value: number }) => {
    progressRenders.count++
    return <div role="progressbar" aria-valuenow={Math.round(value * 100)} />
  },
}))

// jsdom has no layout: give the scroll element a size so the virtualizer renders rows
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 480 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1000 })
})

const tor = (hash: string, extra: Partial<Torrent> = {}): Torrent =>
  ({
    hash, name: `Torrent ${hash}`, state: 'stoppedDL', progress: 0.5, size: 1024 ** 3, completed: 1024 ** 3 / 2,
    dlspeed: 0, upspeed: 0, added_on: 1000, ratio: 1.5, priority: 2, category: '', tags: '', num_seeds: 0, num_leechs: 0,
    eta: 0, uploaded: 0, ...extra,
  }) as Torrent

function load(list: Torrent[], extra: { categories?: string[]; tags?: string[] } = {}) {
  useTorrents.setState({
    ...emptySync,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    categories: Object.fromEntries((extra.categories ?? []).map((n) => [n, { name: n, savePath: '' }])),
    tags: extra.tags ?? [],
  })
}

const rows = () => screen.getAllByRole('row').slice(1)
const names = () => rows().map((r) => within(r).getByText(/^Torrent /).textContent)

beforeEach(() => {
  localStorage.clear()
  progressRenders.count = 0
  useUi.setState({ filter: { type: 'status', value: 'all' }, search: '', sort: { key: 'added_on', dir: 'desc' } })
  useUi.getState().setColumn('queue', false)
  useUi.getState().setColumn('ratio', false)
  useUi.getState().setColumn('added', false)
  localStorage.clear()
})
afterEach(() => {
  useTorrents.setState({ ...emptySync, speedHistory: [] })
})

describe('TorrentTable', () => {
  it('orders by added_on descending by default', () => {
    load([tor('a', { added_on: 1 }), tor('b', { added_on: 3 }), tor('c', { added_on: 2 })])
    render(<TorrentTable />)
    expect(names()).toEqual(['Torrent b', 'Torrent c', 'Torrent a'])
  })

  it('clicking a header changes the column, clicking again flips the direction', async () => {
    load([tor('a', { size: 2 }), tor('b', { size: 3 }), tor('c', { size: 1 })])
    render(<TorrentTable />)
    await userEvent.click(screen.getByRole('button', { name: 'Размер' }))
    expect(useUi.getState().sort.key).toBe('size')
    const first = names()
    await userEvent.click(screen.getByRole('button', { name: 'Размер' }))
    expect(names()).toEqual([...first].reverse())
    expect(screen.getByRole('columnheader', { name: 'Размер' })).toHaveAttribute('aria-sort', useUi.getState().sort.dir === 'asc' ? 'ascending' : 'descending')
  })

  it('filters by the search text', () => {
    load([tor('a', { name: 'Torrent Ubuntu' }), tor('b', { name: 'Torrent Дебиан' })])
    useUi.setState({ search: 'дебиан' })
    render(<TorrentTable />)
    expect(names()).toEqual(['Torrent Дебиан'])
  })

  it('renders only a window of a 1000-row list', () => {
    load(Array.from({ length: 1000 }, (_, i) => tor(`h${i}`, { added_on: i })))
    render(<TorrentTable />)
    expect(rows().length).toBeGreaterThan(5)
    expect(rows().length).toBeLessThan(40)
  })

  it('re-renders only the changed row when one torrent updates', () => {
    const list = ['a', 'b', 'c', 'd'].map((h, i) => tor(h, { added_on: 10 - i }))
    load(list)
    render(<TorrentTable />)
    const before = progressRenders.count
    expect(before).toBe(4)
    act(() => {
      useTorrents.setState((s) => ({ torrents: { ...s.torrents, b: { ...s.torrents.b, progress: 0.6 } } }))
    })
    expect(progressRenders.count - before).toBe(1)
  })

  it('hides optional columns by default and persists the choice in localStorage', async () => {
    load([tor('a')])
    render(<TorrentTable />)
    expect(screen.queryByRole('columnheader', { name: 'Ratio' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: '№ в очереди' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Добавлен' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Колонки' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ratio' }))
    expect(screen.getByRole('columnheader', { name: 'Ratio' })).toBeInTheDocument()
    expect(within(rows()[0]).getByText('1.50')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('qbit.columns')!)).toMatchObject({ ratio: true, queue: false, added: false })
  })

  it('resets a category filter whose value is gone from the store', () => {
    load([tor('a')], { categories: ['linux'] })
    useUi.setState({ filter: { type: 'category', value: 'movies' } })
    render(<TorrentTable />)
    expect(useUi.getState().filter).toEqual({ type: 'status', value: 'all' })
    expect(names()).toEqual(['Torrent a'])
  })

  it('resets a tag filter whose value is gone, and keeps one that still exists', () => {
    load([tor('a')], { tags: ['hd'] })
    useUi.setState({ filter: { type: 'tag', value: 'hd' } })
    const { unmount } = render(<TorrentTable />)
    expect(useUi.getState().filter).toEqual({ type: 'tag', value: 'hd' })
    unmount()
    useUi.setState({ filter: { type: 'tag', value: 'old' } })
    render(<TorrentTable />)
    expect(useUi.getState().filter).toEqual({ type: 'status', value: 'all' })
  })
})

describe('TopBar', () => {
  it('"/" focuses the search field, but not while typing in another input', async () => {
    render(<><TopBar /><input aria-label="other" /></>)
    await userEvent.keyboard('/')
    expect(screen.getByRole('textbox', { name: 'Поиск торрентов' })).toHaveFocus()
    await userEvent.click(screen.getByRole('textbox', { name: 'other' }))
    await userEvent.keyboard('/')
    expect(screen.getByRole('textbox', { name: 'other' })).toHaveFocus()
  })

  it('typing updates the search in the ui store', async () => {
    render(<TopBar />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Поиск торрентов' }), 'abc')
    expect(useUi.getState().search).toBe('abc')
  })

  it('shows "Запустить все" when everything is paused', () => {
    load([tor('a', { state: 'stoppedDL' }), tor('b', { state: 'stoppedUP' })])
    const { unmount } = render(<TopBar />)
    expect(screen.getByRole('button', { name: 'Запустить все' })).toBeInTheDocument()
    unmount()
    load([tor('a', { state: 'downloading' })])
    render(<TopBar />)
    expect(screen.getByRole('button', { name: 'Пауза для всех' })).toBeInTheDocument()
  })
})
