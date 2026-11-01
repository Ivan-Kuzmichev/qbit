// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { emptySync } from '../../store/mergeMainData'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { stubFetch, text } from '../../test/fetchStub'
import { TorrentTable } from './TorrentTable'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('../../components/ui/Toast', () => ({ toast: toastMock }))
const copyMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))
vi.mock('../../lib/copyText', () => ({ copyText: copyMock }))

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 480 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1000 })
})

const tor = (hash: string, extra: Partial<Torrent> = {}): Torrent =>
  ({
    hash, name: `Torrent ${hash}`, state: 'downloading', progress: 0.5, size: 1024 ** 3, completed: 1024 ** 3 / 2,
    dlspeed: 0, upspeed: 0, added_on: 1000, ratio: 1.5, priority: 2, category: '', tags: '', num_seeds: 0, num_leechs: 0,
    eta: 0, uploaded: 0, seq_dl: false, f_l_piece_prio: false, magnet_uri: `magnet:?xt=urn:btih:${hash}`, ...extra,
  }) as Torrent

function load(list: Torrent[], extra: { categories?: string[]; tags?: string[] } = {}) {
  useTorrents.setState({
    ...emptySync,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    categories: Object.fromEntries((extra.categories ?? []).map((n) => [n, { name: n, savePath: '' }])),
    tags: extra.tags ?? [],
    selected: new Set(),
    anchor: null,
    refresh: vi.fn().mockResolvedValue(undefined),
  })
}

const rowOf = (name: string) => screen.getByText(name).closest('[role="row"]') as HTMLElement
const selectedNames = () =>
  screen.getAllByRole('row').filter((r) => r.getAttribute('aria-selected') === 'true').map((r) => r.querySelector('[title]')?.getAttribute('title'))
const body = (f: ReturnType<typeof stubFetch>, i = 0) => new URLSearchParams(String(f.mock.calls[i][1]?.body))

beforeEach(() => {
  localStorage.clear()
  useUi.setState({ filter: { type: 'status', value: 'all' }, search: '', sort: { key: 'added_on', dir: 'asc' } })
  copyMock.mockClear()
  toastMock.mockClear()
})
afterEach(() => {
  useTorrents.setState({ ...emptySync, speedHistory: [] })
  vi.unstubAllGlobals()
})

describe('table semantics', () => {
  it('is a grid, so aria-selected on rows is valid', () => {
    load([tor('a')])
    render(<TorrentTable />)
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(within(rowOf('Torrent a')).getAllByRole('gridcell').length).toBeGreaterThan(0)
  })
})

describe('selection', () => {
  beforeEach(() => {
    load([tor('a', { added_on: 1 }), tor('b', { added_on: 2 }), tor('c', { added_on: 3 }), tor('d', { added_on: 4 })])
  })

  it('click selects one row', async () => {
    render(<TorrentTable />)
    await userEvent.click(screen.getByText('Torrent b'))
    await userEvent.click(screen.getByText('Torrent c'))
    expect(selectedNames()).toEqual(['Torrent c'])
  })

  it('Ctrl adds and removes rows', () => {
    render(<TorrentTable />)
    fireEvent.click(screen.getByText('Torrent a'))
    fireEvent.click(screen.getByText('Torrent c'), { ctrlKey: true })
    expect(selectedNames()).toEqual(['Torrent a', 'Torrent c'])
    fireEvent.click(screen.getByText('Torrent a'), { ctrlKey: true })
    expect(selectedNames()).toEqual(['Torrent c'])
  })

  it('Cmd (meta) also toggles', () => {
    render(<TorrentTable />)
    fireEvent.click(screen.getByText('Torrent a'))
    fireEvent.click(screen.getByText('Torrent b'), { metaKey: true })
    expect(selectedNames()).toEqual(['Torrent a', 'Torrent b'])
  })

  it('Shift selects a range in visible order', () => {
    render(<TorrentTable />)
    fireEvent.click(screen.getByText('Torrent a'))
    fireEvent.click(screen.getByText('Torrent c'), { shiftKey: true })
    expect(selectedNames()).toEqual(['Torrent a', 'Torrent b', 'Torrent c'])
  })

  it('the row action button acts without changing the selection', async () => {
    const f = stubFetch({ 'torrents/stop': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(rowOf('Torrent b')).getByRole('button', { name: 'Пауза' }))
    expect(body(f).get('hashes')).toBe('b')
    expect(selectedNames()).toEqual([])
  })
})

const MENU_ORDER = [
  'Пауза', 'Запустить принудительно', 'Ограничение скорости…', 'Категория', 'Теги', 'Очередь',
  'Последовательная загрузка', 'Сначала первые и последние части', 'Переместить…', 'Перепроверить',
  'Переанонсировать', 'Скопировать magnet', 'Удалить…',
]

describe('context menu', () => {
  const open = (name: string, init: MouseEventInit = { clientX: 100, clientY: 100 }) => {
    fireEvent.contextMenu(screen.getByText(name), init)
    return screen.getByRole('menu')
  }

  it('lists every item from the spec in order', () => {
    load([tor('a')])
    render(<TorrentTable />)
    const menu = open('Torrent a')
    expect([...menu.querySelectorAll('[role^="menuitem"]')].map((i) => i.textContent)).toEqual(MENU_ORDER)
  })

  it('right click on an unselected row selects only it', () => {
    load([tor('a'), tor('b')])
    useTorrents.setState({ selected: new Set(['a']), anchor: 'a' })
    render(<TorrentTable />)
    open('Torrent b')
    expect(selectedNames()).toEqual(['Torrent b'])
  })

  it('right click on a selected row keeps the whole selection and acts on all of it', async () => {
    load([tor('a', { added_on: 1 }), tor('b', { added_on: 2 }), tor('c', { added_on: 3 })])
    useTorrents.setState({ selected: new Set(['a', 'b']), anchor: 'a' })
    const f = stubFetch({ 'torrents/recheck': () => text('') })
    render(<TorrentTable />)
    const menu = open('Torrent b')
    expect(selectedNames()).toEqual(['Torrent a', 'Torrent b'])
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Перепроверить' }))
    expect(body(f).get('hashes')).toBe('a|b')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('shows "Запустить" and starts when every target is paused', async () => {
    load([tor('a', { state: 'stoppedDL' })])
    const f = stubFetch({ 'torrents/start': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Запустить' }))
    expect(body(f).get('hashes')).toBe('a')
  })

  it('force start sends value=true', async () => {
    load([tor('a')])
    const f = stubFetch({ 'torrents/setForceStart': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Запустить принудительно' }))
    expect(body(f).get('value')).toBe('true')
  })

  it('queue submenu offers top, up, down, bottom', async () => {
    load([tor('a')])
    const f = stubFetch({ 'torrents/topPrio': () => text(''), 'torrents/increasePrio': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Очередь' }))
    const sub = screen.getByRole('menu', { name: 'Очередь' })
    expect(within(sub).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Вверх', 'Вниз', 'В начало', 'В конец',
    ])
    await userEvent.click(within(sub).getByRole('menuitem', { name: 'Вверх' }))
    expect(String(f.mock.calls[0][0])).toContain('torrents/increasePrio')
    expect(body(f).get('hashes')).toBe('a')
  })

  it('"В начало" is topPrio', async () => {
    load([tor('a')])
    const f = stubFetch({ 'torrents/topPrio': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Очередь' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'В начало' }))
    expect(String(f.mock.calls[0][0])).toContain('torrents/topPrio')
  })

  it('category submenu calls setCategory', async () => {
    load([tor('a')], { categories: ['Фильмы'] })
    const f = stubFetch({ 'torrents/setCategory': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Категория' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Фильмы' }))
    expect(body(f).get('category')).toBe('Фильмы')
    expect(body(f).get('hashes')).toBe('a')
  })

  it('"Без категории" clears the category', async () => {
    load([tor('a', { category: 'Фильмы' })], { categories: ['Фильмы'] })
    const f = stubFetch({ 'torrents/setCategory': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Категория' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Без категории' }))
    expect(body(f).get('category')).toBe('')
  })

  it('tags submenu adds a missing tag and removes one that all targets have', async () => {
    load([tor('a', { tags: 'x, y' }), tor('b', { tags: 'x', added_on: 2000 })], { tags: ['x', 'y'] })
    useTorrents.setState({ selected: new Set(['a', 'b']), anchor: 'a' })
    const f = stubFetch({ 'torrents/addTags': () => text(''), 'torrents/removeTags': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Теги' }))
    const sub = screen.getByRole('menu', { name: 'Теги' })
    await userEvent.click(within(sub).getByRole('menuitemcheckbox', { name: 'y' }))
    expect(String(f.mock.calls[0][0])).toContain('torrents/addTags')
    expect(body(f).get('tags')).toBe('y')
    expect(body(f).get('hashes')).toBe('a|b')

    fireEvent.contextMenu(screen.getByText('Torrent a'), { clientX: 1, clientY: 1 })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Теги' }))
    const x = within(screen.getByRole('menu', { name: 'Теги' })).getByRole('menuitemcheckbox', { name: 'x' })
    expect(x).toBeChecked()
    await userEvent.click(x)
    expect(String(f.mock.calls[1][0])).toContain('torrents/removeTags')
    expect(body(f, 1).get('tags')).toBe('x')
  })

  it('sequential download toggles only the torrents that differ from the target state', async () => {
    load([tor('a', { seq_dl: true }), tor('b', { seq_dl: false, added_on: 2000 })])
    useTorrents.setState({ selected: new Set(['a', 'b']), anchor: 'a' })
    const f = stubFetch({ 'torrents/toggleSequentialDownload': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitemcheckbox', { name: 'Последовательная загрузка' }))
    expect(body(f).get('hashes')).toBe('b')
  })

  it('copies the magnet links of all targets', async () => {
    load([tor('a'), tor('b', { added_on: 2000 })])
    useTorrents.setState({ selected: new Set(['a', 'b']), anchor: 'a' })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Скопировать magnet' }))
    expect(copyMock).toHaveBeenCalledWith('magnet:?xt=urn:btih:a\nmagnet:?xt=urn:btih:b')
  })

  it('does not claim success when no target has a magnet link', async () => {
    load([tor('a', { magnet_uri: '' })])
    useTorrents.setState({ selected: new Set(['a']), anchor: 'a' })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Скопировать magnet' }))
    expect(copyMock).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith('Не удалось скопировать magnet')
    expect(toastMock).not.toHaveBeenCalledWith('Magnet скопирован')
  })

  it('opens the delete dialog in the useDialogs store by default', async () => {
    load([tor('a')])
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Удалить…' }))
    expect(useDialogs.getState().open).toEqual({ kind: 'delete', hashes: ['a'] })
    useDialogs.getState().close()
  })

  it('dialog items hand the target hashes to onDialog', async () => {
    load([tor('a')])
    const onDialog = vi.fn()
    render(<TorrentTable onDialog={onDialog} />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Удалить…' }))
    expect(onDialog).toHaveBeenCalledWith('delete', ['a'])
  })

  it('stays inside the window near the right and bottom edges', () => {
    load([tor('a')])
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { width: 220, height: 400, top: 0, left: 0, right: 220, bottom: 400, x: 0, y: 0, toJSON() {} } as DOMRect,
    )
    render(<TorrentTable />)
    const menu = open('Torrent a', { clientX: 990, clientY: 690 })
    expect(parseFloat(menu.style.left) + 220).toBeLessThanOrEqual(1000)
    expect(parseFloat(menu.style.top) + 400).toBeLessThanOrEqual(700)
    expect(parseFloat(menu.style.left)).toBeGreaterThanOrEqual(0)
    rect.mockRestore()
  })

  it('ArrowRight on a parent item focuses the first item of its submenu, ArrowLeft returns', async () => {
    load([tor('a')], { categories: ['Фильмы'] })
    render(<TorrentTable />)
    const menu = open('Torrent a')
    within(menu).getByRole('menuitem', { name: 'Категория' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Без категории' }))
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Категория' }))
  })

  it('scrolling inside a submenu does not close the menu, scrolling the page does', async () => {
    load([tor('a')], { categories: ['Фильмы'] })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Категория' }))
    fireEvent.scroll(screen.getByRole('menu', { name: 'Категория' }))
    expect(screen.getByRole('menu', { name: 'Действия с торрентом' })).toBeInTheDocument()
    fireEvent.scroll(document)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape and on an outside click', async () => {
    load([tor('a')])
    render(<TorrentTable />)
    open('Torrent a')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    open('Torrent a')
    await userEvent.click(document.body)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    act(() => {})
  })

  it('Escape closes only the menu and returns focus to the row', async () => {
    load([tor('a')])
    render(<TorrentTable />)
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    open('Torrent a')
    await userEvent.keyboard('{Escape}')
    document.removeEventListener('keydown', outer)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
    expect(rowOf('Torrent a')).toHaveFocus()
  })

  it('Tab closes the menu and keeps focus on the row', async () => {
    load([tor('a')])
    render(<TorrentTable />)
    open('Torrent a')
    await userEvent.keyboard('{Tab}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(rowOf('Torrent a')).toHaveFocus()
  })

  it('picking an item returns focus to the row', async () => {
    load([tor('a')])
    stubFetch({ 'torrents/stop': () => text('') })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Пауза' }))
    expect(rowOf('Torrent a')).toHaveFocus()
  })

  it('a submenu near the bottom of the window is pulled up to fit', async () => {
    load([tor('a')], { categories: ['Фильмы'] })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const sub = this.hasAttribute('data-submenu')
      return { width: 200, height: sub ? 300 : 400, top: sub ? 600 : 0, left: 0, right: 200, bottom: sub ? 900 : 400, x: 0, y: 0, toJSON() {} } as DOMRect
    })
    render(<TorrentTable />)
    await userEvent.click(within(open('Torrent a')).getByRole('menuitem', { name: 'Категория' }))
    const sub = screen.getByRole('menu', { name: 'Категория' })
    // 900 - 700 + 8 px margin
    await waitFor(() => expect(parseFloat(sub.style.top)).toBeLessThanOrEqual(-5 - 208))
    rect.mockRestore()
  })

  it('the pull-up survives closing and reopening the same submenu', async () => {
    load([tor('a')], { categories: ['Фильмы'] })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    // the box moves with its inline top, as in a real layout: natural top 600 at top:-5
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.hasAttribute('data-submenu')) return { width: 200, height: 400, top: 0, left: 0, right: 200, bottom: 400, x: 0, y: 0, toJSON() {} } as DOMRect
      const shifted = parseFloat(this.style.top || '-5') + 5
      const top = 600 + shifted
      return { width: 200, height: 300, top, left: 0, right: 200, bottom: top + 300, x: 0, y: 0, toJSON() {} } as DOMRect
    })
    render(<TorrentTable />)
    const menu = open('Torrent a')
    const cat = within(menu).getByRole('menuitem', { name: 'Категория' })
    fireEvent.mouseEnter(cat)
    await waitFor(() => expect(parseFloat(screen.getByRole('menu', { name: 'Категория' }).style.top)).toBeLessThan(-100))
    fireEvent.mouseEnter(within(menu).getByRole('menuitem', { name: 'Пауза' }))
    expect(screen.queryByRole('menu', { name: 'Категория' })).toBeNull()
    fireEvent.mouseEnter(cat)
    await waitFor(() => expect(parseFloat(screen.getByRole('menu', { name: 'Категория' }).style.top)).toBeLessThan(-100))
    rect.mockRestore()
  })
})
