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

  it('switches tabs', async () => {
    load([tor('a')], ['a'])
    render(<DetailsCard />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Пиры' }))
    expect(screen.getByRole('tab', { name: 'Пиры' })).toHaveAttribute('aria-selected', 'true')
  })
})
