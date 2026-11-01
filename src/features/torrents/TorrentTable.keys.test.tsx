// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { useDialogs } from '../../store/dialogs'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { stubFetch, text } from '../../test/fetchStub'
import { TorrentTable } from './TorrentTable'

vi.mock('../../components/ui/Toast', () => ({ toast: vi.fn(), ToastHost: () => null }))

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 480 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1000 })
  // the virtualizer clamps scroll targets to scrollHeight - clientHeight
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 100_000 })
  // jsdom has no scrollTo on elements: emulate it so the virtualizer sees the new offset
  HTMLElement.prototype.scrollTo = function (this: HTMLElement, arg: ScrollToOptions | number) {
    Object.defineProperty(this, 'scrollTop', { configurable: true, writable: true, value: typeof arg === 'number' ? arg : (arg.top ?? 0) })
    this.dispatchEvent(new Event('scroll'))
  } as typeof HTMLElement.prototype.scrollTo
})

const tor = (hash: string, extra: Partial<Torrent> = {}): Torrent =>
  ({
    hash, name: `Torrent ${hash}`, state: 'downloading', progress: 0.5, size: 1024 ** 3, completed: 1024 ** 3 / 2,
    dlspeed: 0, upspeed: 0, added_on: 1000, ratio: 1.5, priority: 2, category: '', tags: '', num_seeds: 0, num_leechs: 0,
    eta: 0, uploaded: 0, ...extra,
  }) as Torrent

function load(list: Torrent[], selected: string[] = []) {
  useTorrents.setState({
    ...emptySync,
    rid: 1,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    selected: new Set(selected),
    anchor: null,
    refresh: vi.fn().mockResolvedValue(undefined),
  })
}
const abc = () => [tor('a', { added_on: 1 }), tor('b', { added_on: 2 }), tor('c', { added_on: 3 })]
const row = (name: string) => screen.getByText(name).closest('[role="row"]') as HTMLElement
const selected = () => [...useTorrents.getState().selected]

beforeEach(() => {
  localStorage.clear()
  useUi.setState({ filter: { type: 'status', value: 'all' }, search: '', sort: { key: 'added_on', dir: 'asc' } })
})
afterEach(() => {
  useTorrents.setState({ ...emptySync, speedHistory: [] })
  useDialogs.setState({ open: null })
  vi.unstubAllGlobals()
})

describe('rows are focusable (roving tabindex)', () => {
  it('exactly one row is in the tab order: the first by default, the selected one when there is a selection', () => {
    load(abc())
    const { unmount } = render(<TorrentTable />)
    expect(screen.getAllByRole('row').filter((r) => r.getAttribute('tabindex') === '0')).toEqual([row('Torrent a')])
    unmount()
    load(abc(), ['b'])
    render(<TorrentTable />)
    expect(screen.getAllByRole('row').filter((r) => r.getAttribute('tabindex') === '0')).toEqual([row('Torrent b')])
  })

  it('the focus ring is not removed from rows', () => {
    const css = readFileSync('src/features/torrents/TorrentRow.module.css', 'utf8')
    expect(css).toMatch(/\.row:focus-visible/)
  })
})

describe('arrow keys', () => {
  it('ArrowDown selects the first row when nothing is selected, then moves selection and focus down', async () => {
    load(abc())
    render(<TorrentTable />)
    await userEvent.keyboard('{ArrowDown}')
    expect(selected()).toEqual(['a'])
    expect(row('Torrent a')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(selected()).toEqual(['b'])
    expect(row('Torrent b')).toHaveFocus()
    expect(row('Torrent b')).toHaveAttribute('tabindex', '0')
    expect(row('Torrent a')).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowUp moves up and stops at the ends', async () => {
    load(abc(), ['b'])
    render(<TorrentTable />)
    row('Torrent b').focus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(selected()).toEqual(['a'])
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(selected()).toEqual(['c'])
  })

  it('Shift+Arrow extends the selection', async () => {
    load(abc(), ['a'])
    useTorrents.setState({ anchor: 'a' })
    render(<TorrentTable />)
    row('Torrent a').focus()
    await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowDown}{/Shift}')
    expect(selected().sort()).toEqual(['a', 'b', 'c'])
  })

  it('scrolls to the row and focuses it even when it is outside the rendered window', async () => {
    load(Array.from({ length: 300 }, (_, i) => tor(`h${String(i).padStart(3, '0')}`, { added_on: i })))
    render(<TorrentTable />)
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.queryByText('Torrent h040')).toBeNull()
    for (let i = 0; i < 40; i++) await userEvent.keyboard('{ArrowDown}')
    expect(selected()).toEqual(['h040'])
    expect(row('Torrent h040')).toHaveFocus()
  })

  it('does nothing in the search field', async () => {
    load(abc())
    render(
      <>
        <input aria-label="поиск" />
        <TorrentTable />
      </>,
    )
    screen.getByLabelText('поиск').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(selected()).toEqual([])
  })

  it('does nothing while a dialog is open', async () => {
    load(abc())
    render(<TorrentTable />)
    act(() => useDialogs.getState().openAdd('file'))
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(selected()).toEqual([])
  })
})

describe('Enter, Space, Delete', () => {
  it('Enter reduces the selection to the focused row and moves focus to the details card', async () => {
    load(abc(), ['a', 'b'])
    render(
      <>
        <TorrentTable />
        <section data-details tabIndex={-1} aria-label="Детали торрента" />
      </>,
    )
    row('Torrent b').focus()
    await userEvent.keyboard('{Enter}')
    expect(selected()).toEqual(['b'])
    expect(screen.getByLabelText('Детали торрента')).toHaveFocus()
  })

  it('Space pauses the selection and does not scroll the page', async () => {
    load(abc(), ['a', 'b'])
    const f = stubFetch({ 'torrents/stop': () => text('') })
    render(<TorrentTable />)
    row('Torrent a').focus()
    const notPrevented = fireEvent.keyDown(row('Torrent a'), { key: ' ' })
    expect(notPrevented).toBe(false)
    await vi.waitFor(() => expect(f).toHaveBeenCalled())
    expect(String(f.mock.calls[0][0])).toContain('torrents/stop')
    expect(new URLSearchParams(String(f.mock.calls[0][1]?.body)).get('hashes')).toBe('a|b')
  })

  it('holding Space sends one request, not a flip-flop', async () => {
    load(abc(), ['a'])
    const f = stubFetch({ 'torrents/stop': () => text('') })
    render(<TorrentTable />)
    row('Torrent a').focus()
    fireEvent.keyDown(row('Torrent a'), { key: ' ' })
    fireEvent.keyDown(row('Torrent a'), { key: ' ', repeat: true })
    fireEvent.keyDown(row('Torrent a'), { key: ' ', repeat: true })
    await vi.waitFor(() => expect(f).toHaveBeenCalled())
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('Space resumes when every selected torrent is paused', async () => {
    load([tor('a', { state: 'stoppedDL' }), tor('b', { state: 'stoppedUP', progress: 1 })], ['a', 'b'])
    const f = stubFetch({ 'torrents/start': () => text('') })
    render(<TorrentTable />)
    row('Torrent a').focus()
    await userEvent.keyboard(' ')
    await vi.waitFor(() => expect(f).toHaveBeenCalled())
    expect(String(f.mock.calls[0][0])).toContain('torrents/start')
  })

  it('Space on the focused row button presses only that button, once', async () => {
    load(abc(), ['a', 'b'])
    const f = stubFetch({ 'torrents/stop': () => text('') })
    render(<TorrentTable />)
    const btn = row('Torrent c').querySelector('button')!
    btn.focus()
    await userEvent.keyboard(' ')
    await vi.waitFor(() => expect(f).toHaveBeenCalled())
    expect(f).toHaveBeenCalledTimes(1)
    expect(new URLSearchParams(String(f.mock.calls[0][1]?.body)).get('hashes')).toBe('c')
  })

  it('Enter on a focused row button keeps its native meaning', async () => {
    load(abc(), ['a', 'b'])
    stubFetch({ 'torrents/stop': () => text('') })
    render(<TorrentTable />)
    row('Torrent c').querySelector('button')!.focus()
    await userEvent.keyboard('{Enter}')
    expect(selected().sort()).toEqual(['a', 'b'])
  })

  it('Delete and Backspace open the delete dialog for the selection', async () => {
    load(abc(), ['a', 'c'])
    render(<TorrentTable />)
    row('Torrent a').focus()
    await userEvent.keyboard('{Delete}')
    expect(useDialogs.getState().open).toEqual({ kind: 'delete', hashes: expect.arrayContaining(['a', 'c']) })
    useDialogs.getState().close()
    await userEvent.keyboard('{Backspace}')
    expect(useDialogs.getState().open).toMatchObject({ kind: 'delete' })
  })

  it('Backspace in a text field does not open the dialog', async () => {
    load(abc(), ['a'])
    render(
      <>
        <input aria-label="поиск" />
        <TorrentTable />
      </>,
    )
    screen.getByLabelText('поиск').focus()
    await userEvent.keyboard('{Backspace}')
    expect(useDialogs.getState().open).toBeNull()
  })

  it('Delete with nothing selected does nothing', async () => {
    load(abc())
    render(<TorrentTable />)
    await userEvent.keyboard('{Delete}')
    expect(useDialogs.getState().open).toBeNull()
  })
})

describe('empty states in the table', () => {
  it('no torrents: "Торрентов пока нет" with an Add button', () => {
    load([])
    render(<TorrentTable />)
    expect(screen.getByText('Торрентов пока нет')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument()
  })

  it('nothing before the first response: no flash of "no torrents"', () => {
    useTorrents.setState({ ...emptySync, rid: 0 })
    render(<TorrentTable />)
    expect(screen.queryByText('Торрентов пока нет')).toBeNull()
  })

  it('search with no matches: a separate message', () => {
    load(abc())
    useUi.setState({ search: 'qqq' })
    render(<TorrentTable />)
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.queryByText('Торрентов пока нет')).toBeNull()
  })
})
