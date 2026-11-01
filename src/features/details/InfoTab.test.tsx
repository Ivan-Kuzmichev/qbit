// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Properties } from '../../api/types'
import { InfoTab } from './InfoTab'

const copyMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))
vi.mock('../../lib/copyText', () => ({ copyText: copyMock }))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('../../components/ui/Toast', () => ({ toast: toastMock }))
beforeEach(() => {
  copyMock.mockClear()
  toastMock.mockClear()
})

const HASH = 'a'.repeat(40)
const props = (extra: Partial<Properties> = {}): Properties =>
  ({
    save_path: '/downloads/movies', creation_date: 1700000000, piece_size: 4194304, comment: 'hello', total_wasted: 0,
    total_uploaded: 0, total_downloaded: 0, up_limit: -1, dl_limit: 0, time_elapsed: 0, seeding_time: 3600, nb_connections: 0,
    share_ratio: 1.5, addition_date: 1700000000, completion_date: -1, created_by: 'mktorrent', pieces_have: 0, pieces_num: 1000,
    hash: HASH, infohash_v1: HASH, infohash_v2: '', name: 'x', total_size: 4194304000, ...extra,
  }) as Properties
const torrent = { category: 'Movies', tags: 'hd, new' }

describe('InfoTab', () => {
  it('shows path, category, tags and ratio', () => {
    render(<InfoTab properties={props()} torrent={torrent} variant="desktop" />)
    expect(screen.getByText('/downloads/movies')).toBeInTheDocument()
    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.getByText('hd, new')).toBeInTheDocument()
    expect(screen.getByText('1.50')).toBeInTheDocument()
  })

  it('unset dates (-1, 0) show a dash', () => {
    render(<InfoTab properties={props({ completion_date: -1, addition_date: 0 })} torrent={torrent} variant="desktop" />)
    expect(screen.getByText('Завершён').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('Добавлен').nextElementSibling).toHaveTextContent('—')
  })

  it('limits of -1 and 0 mean no limit; a positive limit is a speed', () => {
    const { rerender } = render(<InfoTab properties={props({ up_limit: -1, dl_limit: 0 })} torrent={torrent} variant="desktop" />)
    expect(screen.getByText('Лимиты').nextElementSibling).toHaveTextContent('↓ без ограничения · ↑ без ограничения')
    rerender(<InfoTab properties={props({ up_limit: 1048576, dl_limit: 2097152 })} torrent={torrent} variant="desktop" />)
    expect(screen.getByText('Лимиты').nextElementSibling).toHaveTextContent('↓ 2.00 МБ/с · ↑ 1.00 МБ/с')
  })

  it('clicking the hash copies it', async () => {
    render(<InfoTab properties={props()} torrent={torrent} variant="desktop" />)
    await userEvent.click(screen.getByRole('button', { name: `Скопировать хеш ${HASH}` }))
    expect(copyMock).toHaveBeenCalledWith(HASH)
    expect(toastMock).toHaveBeenCalledWith('Хеш скопирован')
  })

  it('tells the user when copying failed', async () => {
    copyMock.mockResolvedValueOnce(false)
    render(<InfoTab properties={props()} torrent={torrent} variant="desktop" />)
    await userEvent.click(screen.getByRole('button', { name: /Скопировать хеш/ }))
    expect(toastMock).toHaveBeenCalledWith('Не удалось скопировать')
  })

  it('renders a comment with markup as plain text', () => {
    const comment = '<img src=x onerror=alert(1)> see https://example.org'
    const { container } = render(<InfoTab properties={props({ comment })} torrent={torrent} variant="desktop" />)
    expect(screen.getByText(comment)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })

  it('a magnet without metadata does not show NaN', () => {
    render(
      <InfoTab
        properties={props({ total_size: 0, piece_size: -1, pieces_num: -1, pieces_have: -1, share_ratio: NaN, comment: '' })}
        torrent={{ category: '', tags: '' }}
        variant="mobile"
      />,
    )
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })

  it('shows a loading state before properties arrive', () => {
    render(<InfoTab properties={null} torrent={torrent} variant="desktop" />)
    expect(screen.getByText('Загрузка…')).toBeInTheDocument()
  })
})
