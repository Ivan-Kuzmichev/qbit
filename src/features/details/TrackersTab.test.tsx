// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Tracker } from '../../api/types'
import { TrackersTab } from './TrackersTab'

const tr = (url: string, status: number, extra: Partial<Tracker> = {}): Tracker => ({
  url, status, tier: 0, num_peers: 4, num_seeds: 36, num_leeches: 2, num_downloaded: 1204, msg: '', ...extra,
})

const noop = vi.fn().mockResolvedValue(undefined)

describe('TrackersTab', () => {
  it.each([
    [0, 'Отключён'],
    [1, 'Обновляется'],
    [2, 'Работает'],
    [3, 'Обновляется'],
    [4, 'Ошибка'],
  ])('status %i is %s', (status, label) => {
    render(<TrackersTab trackers={[tr('udp://t.example/announce', status)]} variant="desktop" onAdd={noop} onRemove={noop} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows -1 counters as a dash and formats the rest', () => {
    render(
      <TrackersTab
        trackers={[tr('udp://t.example/announce', 2, { num_seeds: -1, num_peers: 4, num_downloaded: 18204, msg: 'ok msg' })]}
        variant="desktop"
        onAdd={noop}
        onRemove={noop}
      />,
    )
    const row = screen.getByText('udp://t.example/announce').closest('[data-row]') as HTMLElement
    expect(within(row).getByText('—')).toBeInTheDocument()
    expect(within(row).getByText('18 204')).toBeInTheDocument()
    expect(within(row).getByText('ok msg')).toBeInTheDocument()
  })

  it('DHT, PeX and LSD rows are muted and cannot be removed', () => {
    render(
      <TrackersTab
        trackers={[tr('** [DHT] **', 2), tr('** [PeX] **', 2), tr('** [LSD] **', 0), tr('udp://t.example/announce', 2)]}
        variant="desktop"
        onAdd={noop}
        onRemove={noop}
      />,
    )
    for (const name of ['** [DHT] **', '** [PeX] **', '** [LSD] **']) {
      expect(screen.getByText(name).closest('[data-row]')).toHaveAttribute('data-muted', 'true')
    }
    expect(screen.getAllByRole('button', { name: /^Действия с трекером/ })).toHaveLength(1)
  })

  it('removes a tracker through the row menu', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(<TrackersTab trackers={[tr('udp://t.example/announce', 2)]} variant="desktop" onAdd={noop} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Действия с трекером udp://t.example/announce' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить трекер' }))
    expect(onRemove).toHaveBeenCalledWith('udp://t.example/announce')
  })

  it('adds trackers, one URL per line, skipping blanks', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<TrackersTab trackers={[]} variant="desktop" onAdd={onAdd} onRemove={noop} />)
    await userEvent.click(screen.getByRole('button', { name: 'Добавить трекер' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Добавить' })).toBeDisabled()
    await userEvent.type(within(dialog).getByRole('textbox'), 'udp://a/announce{enter}{enter}  http://b/announce  ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }))
    expect(onAdd).toHaveBeenCalledWith(['udp://a/announce', 'http://b/announce'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an empty state without trackers', () => {
    render(<TrackersTab trackers={[]} variant="desktop" onAdd={noop} onRemove={noop} />)
    expect(screen.getByText('Трекеров нет')).toBeInTheDocument()
  })

  it('mobile renders cards, not a table', () => {
    render(<TrackersTab trackers={[tr('udp://t.example/announce', 4, { msg: 'Таймаут' })]} variant="mobile" onAdd={noop} onRemove={noop} />)
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    expect(screen.getByText('Ошибка')).toBeInTheDocument()
    expect(screen.getByText('Таймаут')).toBeInTheDocument()
  })
})
