// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { stubFetch, text } from '../../test/fetchStub'
import { MoveDialog } from './MoveDialog'

const tor = (hash: string, save_path: string): Torrent => ({ hash, name: `Torrent ${hash}`, save_path }) as Torrent

beforeEach(() => {
  useTorrents.setState({
    ...emptySync,
    torrents: { a: tor('a', '/data/a'), b: tor('b', '/data/b') },
    refresh: vi.fn().mockResolvedValue(undefined),
  })
})
afterEach(() => {
  useTorrents.setState({ ...emptySync })
  vi.unstubAllGlobals()
})

describe('MoveDialog', () => {
  it('prefills the current path of a single torrent', () => {
    render(<MoveDialog hashes={['a']} onClose={() => {}} />)
    expect(screen.getByLabelText('Новый путь')).toHaveValue('/data/a')
  })

  it('does not send an empty path', async () => {
    const f = stubFetch({})
    const onClose = vi.fn()
    render(<MoveDialog hashes={['a', 'b']} onClose={onClose} />)
    const input = screen.getByLabelText('Новый путь')
    expect(input).toHaveValue('')
    await userEvent.type(input, '   ')
    expect(screen.getByRole('button', { name: 'Переместить' })).toBeDisabled()
    await userEvent.type(input, '{Enter}')
    expect(f).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sends setLocation with the trimmed path for existing hashes', async () => {
    const f = stubFetch({ 'torrents/setLocation': () => text('') })
    const onClose = vi.fn()
    render(<MoveDialog hashes={['a', 'gone']} onClose={onClose} />)
    const input = screen.getByLabelText('Новый путь')
    await userEvent.clear(input)
    await userEvent.type(input, ' /mnt/new ')
    await userEvent.click(screen.getByRole('button', { name: 'Переместить' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const p = new URLSearchParams(String(f.mock.calls[0][1]?.body))
    expect(p.get('hashes')).toBe('a')
    expect(p.get('location')).toBe('/mnt/new')
  })
})
