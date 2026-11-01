// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { stubFetch, text } from '../../test/fetchStub'
import { DeleteDialog } from './DeleteDialog'

const tor = (hash: string, completed: number): Torrent => ({ hash, name: `Torrent ${hash}`, completed }) as Torrent
const GB = 1024 ** 3

function load(list: Torrent[]) {
  useTorrents.setState({
    ...emptySync,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    refresh: vi.fn().mockResolvedValue(undefined),
  })
}
const body = (f: ReturnType<typeof stubFetch>) => new URLSearchParams(String(f.mock.calls[0][1]?.body))

beforeEach(() => load([tor('a', 2.6 * GB), tor('b', GB), tor('c', 0)]))
afterEach(() => {
  useTorrents.setState({ ...emptySync })
  vi.unstubAllGlobals()
})

describe('DeleteDialog', () => {
  it('names one torrent', () => {
    render(<DeleteDialog hashes={['a']} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Удалить торрент?' })).toBeInTheDocument()
    expect(screen.getByText(/Torrent a/)).toBeInTheDocument()
  })

  it('declines the title by count', () => {
    const { unmount } = render(<DeleteDialog hashes={['a', 'b', 'c']} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Удалить 3 торрента?' })).toBeInTheDocument()
    unmount()
    load(Array.from({ length: 5 }, (_, i) => tor(`t${i}`, 0)))
    render(<DeleteDialog hashes={['t0', 't1', 't2', 't3', 't4']} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Удалить 5 торрентов?' })).toBeInTheDocument()
  })

  it('shows the total downloaded size of the targets', () => {
    render(<DeleteDialog hashes={['a', 'b']} onClose={() => {}} />)
    expect(screen.getByText('3.60 ГБ')).toBeInTheDocument()
  })

  it('has the checkbox unchecked on every open', async () => {
    const { unmount } = render(<DeleteDialog hashes={['a']} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()
    unmount()
    render(<DeleteDialog hashes={['a']} onClose={() => {}} />)
    expect(screen.getByRole('checkbox', { name: /Удалить также скачанные файлы/ })).not.toBeChecked()
  })

  it('sends deleteFiles=false by default', async () => {
    const f = stubFetch({ 'torrents/delete': () => text('') })
    const onClose = vi.fn()
    render(<DeleteDialog hashes={['a', 'b']} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(body(f).get('hashes')).toBe('a|b')
    expect(body(f).get('deleteFiles')).toBe('false')
  })

  it('sends deleteFiles=true only when checked', async () => {
    const f = stubFetch({ 'torrents/delete': () => text('') })
    render(<DeleteDialog hashes={['a']} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(f).toHaveBeenCalled())
    expect(body(f).get('deleteFiles')).toBe('true')
  })

  it('stays usable when a torrent disappears and sends only the existing hashes', async () => {
    const f = stubFetch({ 'torrents/delete': () => text('') })
    render(<DeleteDialog hashes={['a', 'b']} onClose={() => {}} />)
    const { b: _gone, ...rest } = useTorrents.getState().torrents
    void _gone
    useTorrents.setState({ torrents: rest })
    expect(await screen.findByRole('dialog', { name: 'Удалить торрент?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(f).toHaveBeenCalled())
    expect(body(f).get('hashes')).toBe('a')
  })

  it('cancel closes without a request', async () => {
    const f = stubFetch({})
    const onClose = vi.fn()
    render(<DeleteDialog hashes={['a']} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onClose).toHaveBeenCalled()
    expect(f).not.toHaveBeenCalled()
  })
})
