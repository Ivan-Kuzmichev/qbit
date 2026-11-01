// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TorrentFile } from '../../api/types'
import { FilesTab } from './FilesTab'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('../../components/ui/Toast', () => ({ toast: toastMock, ToastHost: () => null }))
afterEach(() => toastMock.mockClear())

// jsdom has no layout: give the scroll element a size so the virtualizer renders rows
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 320 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 })
})

const f = (index: number, name: string, size = 1024, priority = 1, progress = 0): TorrentFile => ({
  index, name, size, progress, priority, piece_range: [0, 0], availability: 1,
})
const FILES = [f(3, 'root/a.txt'), f(4, 'root/sub/b.txt', 2048, 7), f(8, 'root/sub/c.txt', 1024, 0)]

describe('FilesTab', () => {
  it('shows an empty state for a torrent without metadata', () => {
    render(<FilesTab files={[]} onSetPriority={vi.fn()} variant="desktop" />)
    expect(screen.getByText('Файлы появятся после получения метаданных')).toBeInTheDocument()
  })

  it('renders folders and files with priority labels', () => {
    render(<FilesTab files={FILES} onSetPriority={vi.fn()} variant="desktop" />)
    expect(screen.getByText('root')).toBeInTheDocument()
    expect(screen.getByText('a.txt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Приоритет: b.txt' })).toHaveTextContent('Максимальный')
    expect(screen.getByRole('button', { name: 'Приоритет: c.txt' })).toHaveTextContent('Не загружать')
    expect(screen.getByRole('button', { name: 'Приоритет: sub' })).toHaveTextContent('Разные')
    expect(screen.getByRole('button', { name: 'Приоритет: a.txt' })).toHaveTextContent('Обычный')
  })

  it('unchecking a file sets priority 0 using its index', async () => {
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(<FilesTab files={FILES} onSetPriority={onSet} variant="desktop" />)
    const box = screen.getByRole('checkbox', { name: 'a.txt' })
    await userEvent.click(box)
    expect(onSet).toHaveBeenCalledWith([3], 0)
    expect(box).not.toBeChecked() // optimistic
  })

  it('checking an unchecked file sets priority 1', async () => {
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(<FilesTab files={FILES} onSetPriority={onSet} variant="desktop" />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'c.txt' }))
    expect(onSet).toHaveBeenCalledWith([8], 1)
  })

  it('a folder sends all nested ids', async () => {
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(<FilesTab files={FILES} onSetPriority={onSet} variant="desktop" />)
    expect(screen.getByRole('checkbox', { name: 'sub' })).toHaveAttribute('aria-checked', 'mixed')
    await userEvent.click(screen.getByRole('checkbox', { name: 'root' }))
    expect(onSet).toHaveBeenCalledWith([3, 4, 8], 1)
  })

  it('the priority menu offers 0, 1, 6, 7', async () => {
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(<FilesTab files={FILES} onSetPriority={onSet} variant="desktop" />)
    await userEvent.click(screen.getByRole('button', { name: 'Приоритет: sub' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((x) => x.textContent)).toEqual([
      'Не загружать', 'Обычный', 'Высокий', 'Максимальный',
    ])
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Высокий' }))
    expect(onSet).toHaveBeenCalledWith([4, 8], 6)
  })

  it('reverts and toasts when the request fails', async () => {
    const onSet = vi.fn().mockRejectedValue(new Error('boom'))
    render(<FilesTab files={FILES} onSetPriority={onSet} variant="desktop" />)
    const box = screen.getByRole('checkbox', { name: 'a.txt' })
    await userEvent.click(box)
    await vi.waitFor(() => expect(toastMock).toHaveBeenCalledWith('Не удалось изменить приоритет'))
    expect(box).toBeChecked()
  })

  it('collapses a folder', async () => {
    render(<FilesTab files={FILES} onSetPriority={vi.fn()} variant="desktop" />)
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть sub' }))
    expect(screen.queryByText('b.txt')).toBeNull()
  })

  it('mobile variant hands the pick to onPickPriority', async () => {
    const onPick = vi.fn()
    render(<FilesTab files={FILES} onSetPriority={vi.fn()} variant="mobile" onPickPriority={onPick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Приоритет: a.txt' }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.txt', ids: [3] }), expect.any(Function))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('mobile variant shows the short priority labels', () => {
    render(<FilesTab files={[f(0, 'a.txt', 1024, 7), f(1, 'b.txt', 1024, 0)]} onSetPriority={vi.fn()} variant="mobile" />)
    expect(screen.getByRole('button', { name: 'Приоритет: a.txt' })).toHaveTextContent('Макс.')
    expect(screen.getByRole('button', { name: 'Приоритет: b.txt' })).toHaveTextContent('Не качать')
  })

  it('virtualizes long lists', () => {
    const many = Array.from({ length: 1200 }, (_, i) => f(i, `file${i}.bin`))
    render(<FilesTab files={many} onSetPriority={vi.fn()} variant="desktop" />)
    const n = screen.getAllByRole('checkbox').length
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(200)
  })

  it('opens the priority menu in document.body on the virtualized path', async () => {
    const onSet = vi.fn().mockResolvedValue(undefined)
    const many = Array.from({ length: 1200 }, (_, i) => f(i, `file${i}.bin`))
    render(<FilesTab files={many} onSetPriority={onSet} variant="desktop" />)
    await userEvent.click(screen.getByRole('button', { name: 'Приоритет: file0.bin' }))
    const menu = screen.getByRole('menu')
    expect(menu.parentElement).toBe(document.body)
    expect(menu.style.position).toBe('fixed')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Высокий' }))
    expect(onSet).toHaveBeenCalledWith([0], 6)
  })
})
