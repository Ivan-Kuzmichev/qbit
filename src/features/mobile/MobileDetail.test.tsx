// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'
import { useDialogs } from '../../store/dialogs'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { json, stubFetch } from '../../test/fetchStub'
import { MobileDetail } from './MobileDetail'

vi.mock('../../components/ui/Toast', () => ({ toast: vi.fn(), ToastHost: () => null }))

const tor = (extra: Partial<Torrent> = {}): Torrent =>
  ({
    hash: 'a', name: 'Blender 4.3 Splash Assets', state: 'downloading', progress: 0.62, size: 1024 ** 3, total_size: 1024 ** 3,
    completed: 1024 ** 3 / 2, downloaded: 0, uploaded: 318 * 1024 ** 2, dlspeed: 12 * 1024 ** 2, upspeed: 820 * 1024, eta: 480,
    ratio: 0.12, num_seeds: 30, num_leechs: 24, save_path: '/data', ...extra,
  }) as Torrent

const file = (index: number, name: string, priority: number) => ({
  index, name, size: 1024, progress: 0.5, priority, piece_range: [0, 0], availability: 1,
})

let fetchMock: ReturnType<typeof stubFetch>
const post = vi.fn((): Response | Promise<Response> => json(''))
beforeEach(() => {
  location.hash = '#/torrent/a'
  useTorrents.setState({
    ...emptySync,
    rid: 5,
    torrents: { a: tor() },
    refresh: vi.fn().mockResolvedValue(undefined),
  })
  fetchMock = stubFetch({
    'torrents/properties': () => json({ save_path: '/data' }),
    'torrents/files': () => json([file(0, 'a.bin', 1), file(1, 'b.bin', 7)]),
    'torrents/pieceStates': () => json([2, 2, 1, 0]),
    'torrents/trackers': () => json([]),
    'torrents/filePrio': post,
    'torrents/stop': post,
    'torrents/start': post,
  })
})
afterEach(() => {
  useTorrents.setState({ ...emptySync })
  useDialogs.setState({ open: null })
  vi.unstubAllGlobals()
  post.mockClear()
})

describe('MobileDetail', () => {
  it('shows the name, status chip, progress and the 3x2 stats', async () => {
    render(<MobileDetail hash="a" />)
    expect(screen.getByRole('heading', { name: 'Blender 4.3 Splash Assets' })).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
    for (const k of ['Загрузка', 'Отдача', 'Осталось', 'Скачано', 'Отдано', 'Ratio']) expect(screen.getByText(k)).toBeInTheDocument()
    expect(screen.getByText('12.0 МБ/с')).toBeInTheDocument()
    expect(screen.getByText('0.12')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Карта кусков' })).toBeInTheDocument()
    await screen.findByText('a.bin')
  })

  it('uses the short priority labels', async () => {
    render(<MobileDetail hash="a" />)
    await screen.findByText('a.bin')
    expect(screen.getByRole('button', { name: 'Приоритет: b.bin' })).toHaveTextContent('Макс.')
    expect(screen.getByRole('button', { name: 'Приоритет: a.bin' })).toHaveTextContent('Обычный')
  })

  it('the priority button opens an action sheet that sets the priority', async () => {
    render(<MobileDetail hash="a" />)
    await screen.findByText('a.bin')
    await userEvent.click(screen.getByRole('button', { name: 'Приоритет: a.bin' }))
    const sheet = screen.getByRole('dialog')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Не загружать' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('torrents/filePrio'))!
    expect(String(call[1]?.body)).toBe('hash=a&id=0&priority=0')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a failed priority change from the sheet is reverted and toasted', async () => {
    post.mockImplementationOnce(() => json('', 500))
    render(<MobileDetail hash="a" />)
    await screen.findByText('a.bin')
    const button = screen.getByRole('button', { name: 'Приоритет: a.bin' })
    await userEvent.click(button)
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Не загружать' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.details.files.failed))
    expect(screen.getByRole('button', { name: 'Приоритет: a.bin' })).toHaveTextContent('Обычный')
  })

  it('applies a sheet choice optimistically before the server answers', async () => {
    let release: () => void = () => {}
    post.mockImplementationOnce(() => new Promise<Response>((res) => { release = () => res(json('')) }))
    render(<MobileDetail hash="a" />)
    await screen.findByText('a.bin')
    await userEvent.click(screen.getByRole('button', { name: 'Приоритет: a.bin' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Не загружать' }))
    expect(screen.getByRole('button', { name: 'Приоритет: a.bin' })).not.toHaveTextContent('Обычный')
    release()
  })

  it('switches between the four tabs', async () => {
    render(<MobileDetail hash="a" />)
    for (const name of ['Трекеры', 'Пиры', 'Сведения', 'Файлы']) {
      await userEvent.click(screen.getByRole('tab', { name }))
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
    }
  })

  it('the bottom button pauses a running torrent and resumes a stopped one', async () => {
    const { unmount } = render(<MobileDetail hash="a" />)
    await userEvent.click(screen.getByRole('button', { name: 'Приостановить' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('torrents/stop'))).toBe(true))
    unmount()
    useTorrents.setState({ torrents: { a: tor({ state: 'stoppedDL' }) } })
    render(<MobileDetail hash="a" />)
    await userEvent.click(screen.getByRole('button', { name: 'Возобновить' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('torrents/start'))).toBe(true))
  })

  it('"Переместить" and "Удалить" open the shared dialogs for this torrent', async () => {
    render(<MobileDetail hash="a" />)
    await userEvent.click(screen.getByRole('button', { name: 'Переместить' }))
    expect(useDialogs.getState().open).toEqual({ kind: 'move', hashes: ['a'] })
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(useDialogs.getState().open).toEqual({ kind: 'delete', hashes: ['a'] })
  })

  it('back goes to the list', async () => {
    render(<MobileDetail hash="a" />)
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(location.hash).toBe('#/')
  })

  it('returns to the list when the torrent disappears', async () => {
    render(<MobileDetail hash="a" />)
    expect(location.hash).toBe('#/torrent/a')
    useTorrents.setState({ torrents: {} })
    await waitFor(() => expect(location.hash).toBe('#/'))
  })

  it('does not leave while the first sync has not arrived', () => {
    useTorrents.setState({ ...emptySync, rid: 0, torrents: {} })
    render(<MobileDetail hash="a" />)
    expect(location.hash).toBe('#/torrent/a')
  })
})
