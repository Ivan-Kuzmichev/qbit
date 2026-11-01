// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerState, Torrent } from '../../api/types'
import { useDialogs } from '../../store/dialogs'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { stubFetch, text } from '../../test/fetchStub'
import { ALL_FILTER } from '../torrents/filters'
import { MobileLayout } from './MobileLayout'

vi.mock('../../components/ui/Toast', () => ({ toast: vi.fn() }))

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 600 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 390 })
})

const tor = (hash: string, extra: Partial<Torrent> = {}): Torrent =>
  ({
    hash, name: `Torrent ${hash}`, state: 'downloading', progress: 0.5, size: 1024 ** 3, completed: 1024 ** 3 / 2,
    dlspeed: 1024 ** 2, upspeed: 0, added_on: 1000, ratio: 1.5, priority: 2, category: '', tags: '', num_seeds: 0,
    num_leechs: 0, eta: 600, uploaded: 0, ...extra,
  }) as Torrent

function load(list: Torrent[], extra: { categories?: string[]; server?: object } = {}) {
  useTorrents.setState({
    ...emptySync,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    categories: Object.fromEntries((extra.categories ?? []).map((n) => [n, { name: n, savePath: '' }])),
    server: { dl_info_speed: 2 * 1024 ** 2, up_info_speed: 1024, ...extra.server } as ServerState,
    selected: new Set(),
    refresh: vi.fn().mockResolvedValue(undefined),
  })
}

const posts: { path: string; body: string }[] = []
beforeEach(() => {
  posts.length = 0
  window.location.hash = ''
  useUi.setState({ filter: ALL_FILTER, search: '' })
  useDialogs.setState({ open: null })
  stubFetch(
    new Proxy({}, {
      get: (_t, path: string) => (_url: string, init?: RequestInit) => {
        posts.push({ path, body: String(init?.body ?? '') })
        return text('')
      },
    }) as never,
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useTorrents.setState({ ...emptySync, speedHistory: [] })
})

const rowLink = (name: string) => screen.getByRole('link', { name: new RegExp(name) })

function holdRow(name: string) {
  const link = rowLink(name)
  fireEvent.pointerDown(link, { clientX: 5, clientY: 5, button: 0 })
  act(() => void vi.advanceTimersByTime(500))
  fireEvent.pointerUp(link)
}

describe('MobileList', () => {
  it('renders a row per torrent with status and speed', () => {
    load([tor('a')])
    render(<MobileLayout />)
    const row = rowLink('Torrent a')
    expect(within(row).getByText('Скачивается')).toBeInTheDocument()
    expect(within(row).getByText(/1.00 МБ\/с/)).toBeInTheDocument()
    expect(within(row).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('a tap goes to the torrent screen', async () => {
    load([tor('abc123')])
    render(<MobileLayout />)
    await userEvent.click(rowLink('Torrent abc123'))
    expect(window.location.hash).toBe('#/torrent/abc123')
  })

  it('holding a row for 500 ms opens the action sheet with its actions', () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    holdRow('Torrent a')
    const sheet = screen.getByRole('dialog')
    for (const name of ['Пауза', 'Ограничение скорости', 'Категория', 'Удалить']) {
      expect(within(sheet).getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('shows Запустить for a paused torrent', () => {
    vi.useFakeTimers()
    load([tor('a', { state: 'stoppedDL' })])
    render(<MobileLayout />)
    holdRow('Torrent a')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Запустить' })).toBeInTheDocument()
  })

  it('a finger moving more than 10px cancels the hold', () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    const link = rowLink('Torrent a')
    fireEvent.pointerDown(link, { clientX: 5, clientY: 5, button: 0 })
    fireEvent.pointerMove(link, { clientX: 5, clientY: 30 })
    act(() => void vi.advanceTimersByTime(600))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the click after a long press does not navigate', () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    holdRow('Torrent a')
    fireEvent.click(rowLink('Torrent a'))
    expect(window.location.hash).toBe('')
  })

  it('Пауза stops that torrent and closes the sheet', async () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    holdRow('Torrent a')
    vi.useRealTimers()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Пауза' }))
    expect(posts).toEqual([{ path: 'torrents/stop', body: expect.stringContaining('hashes=a') }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Удалить closes the sheet and opens the delete dialog', async () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    holdRow('Torrent a')
    vi.useRealTimers()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))
    expect(useDialogs.getState().open).toEqual({ kind: 'delete', hashes: ['a'] })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Ограничение скорости opens the torrent limits dialog', async () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    holdRow('Torrent a')
    vi.useRealTimers()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ограничение скорости' }))
    expect(useDialogs.getState().open).toEqual({ kind: 'limits', tab: 'torrent', hashes: ['a'] })
  })

  it('Категория opens a second sheet with a way to clear it', async () => {
    vi.useFakeTimers()
    load([tor('a')], { categories: ['linux', 'movies'] })
    render(<MobileLayout />)
    holdRow('Torrent a')
    vi.useRealTimers()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Категория' }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual(['Без категории', 'linux', 'movies', 'Отмена'])
    await userEvent.click(within(sheet).getByRole('button', { name: 'movies' }))
    expect(posts[0].path).toBe('torrents/setCategory')
    expect(posts[0].body).toContain('category=movies')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('moves focus into the category sheet when it replaces the main one', async () => {
    vi.useFakeTimers()
    load([tor('a')], { categories: ['linux'] })
    render(<MobileLayout />)
    holdRow('Torrent a')
    vi.useRealTimers()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Категория' }))
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
  })

  it('closes by Esc and by a tap on the backdrop', async () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    holdRow('Torrent a')
    vi.useRealTimers()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    vi.useFakeTimers()
    holdRow('Torrent a')
    vi.useRealTimers()
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps focus inside the sheet on Tab', async () => {
    vi.useFakeTimers()
    load([tor('a')])
    render(<MobileLayout />)
    holdRow('Torrent a')
    vi.useRealTimers()
    const sheet = screen.getByRole('dialog')
    const buttons = within(sheet).getAllByRole('button')
    expect(buttons[0]).toHaveFocus()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(buttons[buttons.length - 1]).toHaveFocus()
    await userEvent.tab()
    expect(buttons[0]).toHaveFocus()
  })

  it('suppresses the browser context menu on rows', () => {
    load([tor('a')])
    render(<MobileLayout />)
    expect(fireEvent.contextMenu(rowLink('Torrent a'))).toBe(false)
  })
})

describe('MobileLayout', () => {
  it('filter chips show counts from countByFilter and apply the filter', async () => {
    load([tor('a'), tor('b', { state: 'stoppedDL' }), tor('c', { state: 'uploading', progress: 1 })])
    render(<MobileLayout />)
    expect(screen.getByRole('button', { name: /^Все\s*3$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Загрузка\s*1$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Пауза\s*1$/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Пауза/ }))
    expect(useUi.getState().filter).toEqual({ type: 'status', value: 'paused' })
    expect(screen.queryByRole('link', { name: /Torrent a/ })).toBeNull()
    expect(rowLink('Torrent b')).toBeInTheDocument()
  })

  it('the search box filters rows and is 16px', async () => {
    load([tor('a', { name: 'Ubuntu' }), tor('b', { name: 'Debian' })])
    render(<MobileLayout />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Поиск торрентов' }), 'deb')
    expect(screen.queryByRole('link', { name: /Ubuntu/ })).toBeNull()
    expect(rowLink('Debian')).toBeInTheDocument()
  })

  it('the alt-limits button mirrors use_alt_speed_limits and toggles it', async () => {
    load([tor('a')], { server: { use_alt_speed_limits: true } })
    render(<MobileLayout />)
    const btn = screen.getByRole('button', { name: 'Альтернативные лимиты скорости' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(btn)
    expect(posts[0].path).toBe('transfer/toggleSpeedLimitsMode')
  })

  it('alt-limits button is not pressed when the mode is off', () => {
    load([tor('a')])
    render(<MobileLayout />)
    expect(screen.getByRole('button', { name: 'Альтернативные лимиты скорости' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows current speeds in the header', () => {
    load([])
    render(<MobileLayout />)
    expect(screen.getByText('↓ 2.00 МБ/с')).toBeInTheDocument()
    expect(screen.getByText('↑ 1.00 КБ/с')).toBeInTheDocument()
  })

  it('footer buttons open the add dialog and settings', async () => {
    load([])
    render(<MobileLayout />)
    await userEvent.click(screen.getByRole('button', { name: 'Добавить торрент' }))
    expect(useDialogs.getState().open).toMatchObject({ kind: 'add', tab: 'file' })
    useDialogs.setState({ open: null })
    await userEvent.click(screen.getByRole('button', { name: 'Добавить magnet' }))
    expect(useDialogs.getState().open).toMatchObject({ kind: 'add', tab: 'magnet' })
    await userEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    expect(window.location.hash).toBe('#/settings')
  })

  it('renders a placeholder for #/torrent/<hash>', () => {
    load([tor('a')])
    window.location.hash = '#/torrent/a'
    render(<MobileLayout />)
    expect(screen.queryByRole('link', { name: /Torrent a/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument()
  })
})
