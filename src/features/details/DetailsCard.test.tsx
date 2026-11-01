// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { useDialogs } from '../../store/dialogs'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { json, stubFetch } from '../../test/fetchStub'
import { DialogHost } from '../torrents/DialogHost'
import { DetailsCard } from './DetailsCard'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('../../components/ui/Toast', () => ({ toast: toastMock, ToastHost: () => null }))

const tor = (hash: string, extra: Partial<Torrent> = {}): Torrent =>
  ({
    hash, name: `Torrent ${hash}`, state: 'downloading', progress: 0.62, size: 1024 ** 3, total_size: 1024 ** 3,
    completed: 1024 ** 3 / 2, downloaded: 0, uploaded: 0, dlspeed: 0, upspeed: 0, eta: 0, num_seeds: 3, num_leechs: 2,
    save_path: '/data', ...extra,
  }) as Torrent

function load(list: Torrent[], selected: string[]) {
  useTorrents.setState({
    ...emptySync,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    selected: new Set(selected),
    refresh: vi.fn().mockResolvedValue(undefined),
  })
}

let fetchMock: ReturnType<typeof stubFetch>
beforeEach(() => {
  fetchMock = stubFetch({
    'torrents/properties': () => json({ save_path: '/data' }),
    'torrents/files': () => json([]),
    'torrents/pieceStates': () => json([]),
    'torrents/increasePrio': () => new Response('', { status: 409 }),
    'torrents/stop': () => json(''),
    'torrents/start': () => json(''),
  })
})
afterEach(() => {
  useTorrents.setState({ ...emptySync, selected: new Set() })
  useDialogs.setState({ open: null })
  vi.unstubAllGlobals()
  toastMock.mockClear()
})

describe('DetailsCard files tab', () => {
  it('posts filePrio with the file index', async () => {
    const prio = vi.fn(() => json(''))
    fetchMock = stubFetch({
      'torrents/properties': () => json({}),
      'torrents/pieceStates': () => json([]),
      'torrents/files': () =>
        json([{ index: 4, name: 'x.bin', size: 10, progress: 0, priority: 1, piece_range: [0, 0], availability: 1 }]),
      'torrents/filePrio': prio,
    })
    load([tor('a')], ['a'])
    render(<DetailsCard />)
    await userEvent.click(await screen.findByRole('checkbox', { name: 'x.bin' }))
    await vi.waitFor(() => expect(prio).toHaveBeenCalled())
    const calls = fetchMock.mock.calls.filter(([u]) => String(u).includes('torrents/filePrio'))
    expect(String(calls[0][1]?.body)).toBe('hash=a&id=4&priority=0')
  })
})

describe('DetailsCard trackers, peers and info tabs', () => {
  const bodyOf = (path: string) => String(fetchMock.mock.calls.find(([u]) => String(u).includes(path))?.[1]?.body)

  it('adds trackers with one URL per line and removes one by its address', async () => {
    const add = vi.fn(() => json(''))
    const remove = vi.fn(() => json(''))
    fetchMock = stubFetch({
      'torrents/properties': () => json({}),
      'torrents/pieceStates': () => json([]),
      'torrents/files': () => json([]),
      'torrents/trackers': () =>
        json([{ url: 'udp://t.example/announce', status: 2, tier: 0, num_peers: 1, num_seeds: 2, num_leeches: 0, num_downloaded: 3, msg: '' }]),
      'torrents/addTrackers': add,
      'torrents/removeTrackers': remove,
    })
    load([tor('a')], ['a'])
    render(<DetailsCard />)
    await userEvent.click(screen.getByRole('tab', { name: 'Трекеры' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Действия с трекером udp://t.example/announce' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить трекер' }))
    await vi.waitFor(() => expect(remove).toHaveBeenCalled())
    expect(new URLSearchParams(bodyOf('removeTrackers')).get('urls')).toBe('udp://t.example/announce')

    await userEvent.click(screen.getByRole('button', { name: 'Добавить трекер' }))
    await userEvent.type(screen.getByRole('textbox'), 'udp://a/announce{enter}http://b/announce')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    await vi.waitFor(() => expect(add).toHaveBeenCalled())
    const body = new URLSearchParams(bodyOf('addTrackers'))
    expect(body.get('hash')).toBe('a')
    expect(body.get('urls')).toBe('udp://a/announce\nhttp://b/announce')
  })

  it('peers tab shows connected and swarm counts from the torrent', async () => {
    fetchMock = stubFetch({
      'torrents/properties': () => json({}),
      'torrents/pieceStates': () => json([]),
      'torrents/files': () => json([]),
      'sync/torrentPeers': () => json({ rid: 1, full_update: true, peers: { 'a:1': { ip: 'a', port: 1, client: 'x', progress: 0, flags: '', flags_desc: '' } } }),
    })
    load([tor('a', { num_complete: 30, num_incomplete: 11 })], ['a'])
    render(<DetailsCard />)
    await userEvent.click(screen.getByRole('tab', { name: 'Пиры' }))
    expect(await screen.findByText('1 подключено · 41 в рое')).toBeInTheDocument()
  })

  it('peers tab shows only the connected count when the swarm is unknown', async () => {
    load([tor('a', { num_complete: -1, num_incomplete: -1 })], ['a'])
    render(<DetailsCard />)
    await userEvent.click(screen.getByRole('tab', { name: 'Пиры' }))
    expect(await screen.findByText('0 подключено')).toBeInTheDocument()
  })

  it('info tab shows the torrent category', async () => {
    load([tor('a', { category: 'Movies' })], ['a'])
    render(<DetailsCard />)
    await userEvent.click(screen.getByRole('tab', { name: 'Сведения' }))
    expect(await screen.findByText('Movies')).toBeInTheDocument()
  })
})

describe('DetailsCard', () => {
  it('is hidden without selection', () => {
    load([tor('a')], [])
    render(<DetailsCard />)
    expect(screen.queryByRole('region', { name: 'Детали торрента' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is hidden with several selected', () => {
    load([tor('a'), tor('b')], ['a', 'b'])
    render(<DetailsCard />)
    expect(screen.queryByRole('region', { name: 'Детали торрента' })).toBeNull()
  })

  it('shows the torrent and hides when it disappears', async () => {
    load([tor('a')], ['a'])
    render(<DetailsCard />)
    expect(await screen.findByRole('region', { name: 'Детали торрента' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Torrent a' })).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
    await act(async () => {
      useTorrents.setState({ torrents: {} })
    })
    expect(screen.queryByRole('region', { name: 'Детали торрента' })).toBeNull()
  })

  it('shows 0 B and 0% for a magnet without metadata, with no NaN', async () => {
    load([tor('m', { size: 0, total_size: 0, completed: 0, progress: NaN, state: 'metaDL', eta: 8640000 })], ['m'])
    const { container } = render(<DetailsCard />)
    expect(await screen.findByText('0%')).toBeInTheDocument()
    expect(screen.getAllByText(/0 Б/).length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/NaN/)
  })

  it('opens the move dialog', async () => {
    load([tor('a')], ['a'])
    render(
      <>
        <DetailsCard />
        <DialogHost />
      </>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Переместить' }))
    expect(await screen.findByLabelText('Новый путь')).toHaveValue('/data')
  })

  it('opens the delete dialog', async () => {
    load([tor('a')], ['a'])
    render(
      <>
        <DetailsCard />
        <DialogHost />
      </>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }))
    expect(useDialogs.getState().open).toEqual({ kind: 'delete', hashes: ['a'] })
  })

  it('offers pause for a running torrent and resume for a stopped one', async () => {
    load([tor('a')], ['a'])
    const { unmount } = render(<DetailsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Приостановить' }))
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('torrents/stop'))).toBe(true)
    unmount()
    load([tor('a', { state: 'stoppedDL' })], ['a'])
    render(<DetailsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Возобновить' }))
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('torrents/start'))).toBe(true)
  })

  it('toasts instead of crashing when the queue is disabled (409)', async () => {
    load([tor('a')], ['a'])
    render(<DetailsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Выше в очереди' }))
    expect(toastMock).toHaveBeenCalledWith('Не удалось выполнить действие')
  })

  it('shows the file count on open without polling files again on another tab', async () => {
    stubFetch({
      'torrents/properties': () => json({}),
      'torrents/pieceStates': () => json([]),
      'torrents/files': () => json([0, 1, 2].map((index) => ({ index, name: `f${index}`, size: 1, progress: 0, priority: 1 }))),
    })
    load([tor('a')], ['a'])
    render(<DetailsCard />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Сведения' }))
    expect(await screen.findByText('3 файла')).toBeInTheDocument()
  })

  it('switches tabs', async () => {
    load([tor('a')], ['a'])
    render(<DetailsCard />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Пиры' }))
    expect(screen.getByRole('tab', { name: 'Пиры' })).toHaveAttribute('aria-selected', 'true')
  })
})
