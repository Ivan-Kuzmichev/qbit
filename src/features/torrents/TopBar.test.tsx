// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { useDialogs } from '../../store/dialogs'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { stubFetch, text } from '../../test/fetchStub'
import { TopBar } from './TopBar'

const tor = (hash: string, state: string): Torrent => ({ hash, state, progress: 0.5 }) as Torrent

function load(list: Torrent[], selected: string[] = []) {
  useTorrents.setState({
    ...emptySync,
    torrents: Object.fromEntries(list.map((x) => [x.hash, x])),
    selected: new Set(selected),
    refresh: vi.fn().mockResolvedValue(undefined),
  })
}
const body = (f: ReturnType<typeof stubFetch>) => new URLSearchParams(String(f.mock.calls[0][1]?.body))

beforeEach(() => localStorage.clear())
afterEach(() => {
  useTorrents.setState({ ...emptySync, selected: new Set() })
  vi.unstubAllGlobals()
})

describe('TopBar pause all', () => {
  it('pauses everything when nothing is selected', async () => {
    load([tor('a', 'downloading'), tor('b', 'stoppedDL')])
    const f = stubFetch({ 'torrents/stop': () => text('') })
    render(<TopBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Пауза для всех' }))
    expect(String(f.mock.calls[0][0])).toContain('torrents/stop')
    expect(body(f).get('hashes')).toBe('all')
  })

  it('pauses only the selection when there is one', async () => {
    load([tor('a', 'downloading'), tor('b', 'downloading')], ['b'])
    const f = stubFetch({ 'torrents/stop': () => text('') })
    render(<TopBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Пауза для всех' }))
    expect(body(f).get('hashes')).toBe('b')
  })

  it('becomes "Запустить все" when everything is paused', async () => {
    load([tor('a', 'stoppedDL'), tor('b', 'stoppedUP')])
    const f = stubFetch({ 'torrents/start': () => text('') })
    render(<TopBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Запустить все' }))
    expect(String(f.mock.calls[0][0])).toContain('torrents/start')
    expect(body(f).get('hashes')).toBe('all')
  })

  it('is disabled for an empty list', () => {
    load([])
    render(<TopBar />)
    expect(screen.getByRole('button', { name: 'Пауза для всех' })).toBeDisabled()
  })
})

describe('TopBar add buttons', () => {
  afterEach(() => useDialogs.setState({ open: null }))

  it('"Добавить торрент" opens the dialog on the file tab', async () => {
    load([])
    render(<TopBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Добавить торрент' }))
    expect(useDialogs.getState().open).toMatchObject({ kind: 'add', tab: 'file' })
  })

  it('"Добавить magnet" opens it on the magnet tab', async () => {
    load([])
    render(<TopBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Добавить magnet' }))
    expect(useDialogs.getState().open).toMatchObject({ kind: 'add', tab: 'magnet' })
  })
})

describe('TopBar search hotkey', () => {
  it('"/" focuses the search field', async () => {
    load([])
    render(<TopBar />)
    await userEvent.keyboard('/')
    expect(screen.getByRole('textbox', { name: 'Поиск торрентов' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Поиск торрентов' })).toHaveValue('')
  })

  it('"/" works from a button too, but not while a dialog is open', async () => {
    load([])
    render(<TopBar />)
    screen.getByRole('button', { name: 'Пауза для всех' }).focus()
    await userEvent.keyboard('/')
    expect(screen.getByRole('textbox', { name: 'Поиск торрентов' })).toHaveFocus()
    ;(document.activeElement as HTMLElement).blur()
    useDialogs.getState().openAdd('file')
    await userEvent.keyboard('/')
    expect(screen.getByRole('textbox', { name: 'Поиск торрентов' })).not.toHaveFocus()
    useDialogs.getState().close()
  })
})
