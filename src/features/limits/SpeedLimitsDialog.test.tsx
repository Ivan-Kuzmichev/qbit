// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerState, Torrent } from '../../api/types'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { json, stubFetch, text } from '../../test/fetchStub'
import { SpeedLimitsDialog } from './SpeedLimitsDialog'

const MB = 1024 * 1024
const tor = (hash: string, extra: Partial<Torrent> = {}): Torrent =>
  ({ hash, name: `Torrent ${hash}`, dl_limit: 0, up_limit: 0, ...extra }) as Torrent

const prefs = { dl_limit: 0, up_limit: 5 * MB, alt_dl_limit: 2 * MB, alt_up_limit: MB }

function setup(extra: { torrents?: Record<string, Torrent>; server?: Partial<ServerState>; prefs?: object } = {}) {
  useTorrents.setState({
    ...emptySync,
    torrents: extra.torrents ?? { a: tor('a'), b: tor('b') },
    server: { use_alt_speed_limits: false, ...extra.server } as ServerState,
    refresh: vi.fn().mockResolvedValue(undefined),
  })
  return stubFetch({
    'app/preferences': () => json(extra.prefs ?? prefs),
    'transfer/setDownloadLimit': () => text(''),
    'transfer/setUploadLimit': () => text(''),
    'app/setPreferences': () => text(''),
    'torrents/setDownloadLimit': () => text(''),
    'torrents/setUploadLimit': () => text(''),
  })
}

afterEach(() => {
  useTorrents.setState({ ...emptySync })
  vi.unstubAllGlobals()
})
beforeEach(() => vi.useRealTimers())

const dl = () => screen.getByLabelText('Загрузка')
const up = () => screen.getByLabelText('Отдача')
const apply = () => screen.getByRole('button', { name: 'Применить' })
const posts = (f: ReturnType<typeof stubFetch>, path: string) =>
  f.mock.calls.filter(([u, i]) => String(u).endsWith(path) && i?.method === 'POST').map(([, i]) => new URLSearchParams(String(i?.body)))

describe('SpeedLimitsDialog', () => {
  it('the torrent tab is unavailable without a selection', async () => {
    setup()
    render(<SpeedLimitsDialog tab="torrent" hashes={[]} onClose={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Для торрента' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Глобальные' })).toBeChecked()
    await waitFor(() => expect(up()).toHaveValue('5'))
  })

  it('falls back to the global tab when the torrent disappears', async () => {
    setup({ torrents: { a: tor('a') } })
    render(<SpeedLimitsDialog tab="torrent" hashes={['a']} onClose={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Для торрента' })).toBeChecked()
    act(() => useTorrents.setState({ torrents: {} }))
    expect(screen.getByRole('radio', { name: 'Для торрента' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Глобальные' })).toBeChecked()
    await waitFor(() => expect(up()).toHaveValue('5'))
  })

  it('global tab loads app/preferences and posts transfer limits in bytes', async () => {
    const f = setup()
    const onClose = vi.fn()
    render(<SpeedLimitsDialog tab="global" hashes={[]} onClose={onClose} />)
    await waitFor(() => expect(up()).toHaveValue('5'))
    expect(dl()).toHaveValue('∞')
    await userEvent.clear(dl())
    await userEvent.type(dl(), '2')
    await userEvent.click(apply())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(posts(f, 'transfer/setDownloadLimit')[0].get('limit')).toBe(String(2 * MB))
    expect(posts(f, 'transfer/setUploadLimit')[0].get('limit')).toBe(String(5 * MB))
  })

  it('alternative tab saves alt_dl_limit and alt_up_limit through setPreferences', async () => {
    const f = setup()
    render(<SpeedLimitsDialog tab="alt" hashes={[]} onClose={() => {}} />)
    await waitFor(() => expect(dl()).toHaveValue('2'))
    expect(up()).toHaveValue('1')
    await userEvent.clear(dl())
    await userEvent.type(dl(), '5')
    await userEvent.click(apply())
    await waitFor(() => expect(posts(f, 'app/setPreferences')).toHaveLength(1))
    expect(JSON.parse(posts(f, 'app/setPreferences')[0].get('json')!)).toEqual({ alt_dl_limit: 5 * MB, alt_up_limit: MB })
  })

  it('torrent tab shows the torrent limits and posts them for the selected hashes', async () => {
    const f = setup({ torrents: { a: tor('a', { dl_limit: MB, up_limit: 0 }) } })
    render(<SpeedLimitsDialog tab="torrent" hashes={['a', 'gone']} onClose={() => {}} />)
    expect(dl()).toHaveValue('1')
    expect(up()).toHaveValue('∞')
    await userEvent.click(screen.getAllByRole('button', { name: '10' })[1])
    await userEvent.click(apply())
    await waitFor(() => expect(posts(f, 'torrents/setUploadLimit')).toHaveLength(1))
    const p = posts(f, 'torrents/setUploadLimit')[0]
    expect(p.get('hashes')).toBe('a')
    expect(p.get('limit')).toBe(String(10 * MB))
    expect(posts(f, 'torrents/setDownloadLimit')[0].get('limit')).toBe(String(MB))
  })

  it('differing limits of several torrents show an empty field and are left alone if untouched', async () => {
    const f = setup({ torrents: { a: tor('a', { dl_limit: MB }), b: tor('b', { dl_limit: 2 * MB }) } })
    render(<SpeedLimitsDialog tab="torrent" hashes={['a', 'b']} onClose={() => {}} />)
    expect(dl()).toHaveValue('')
    expect(dl()).toHaveAttribute('placeholder', 'Разные')
    await userEvent.click(apply())
    await waitFor(() => expect(posts(f, 'torrents/setUploadLimit')).toHaveLength(1))
    expect(posts(f, 'torrents/setDownloadLimit')).toHaveLength(0)
  })

  it('presets fill the field and the matching one is pressed', async () => {
    setup()
    render(<SpeedLimitsDialog tab="global" hashes={[]} onClose={() => {}} />)
    await waitFor(() => expect(up()).toHaveValue('5'))
    const rows = screen.getAllByRole('group')
    const preset = (row: number, name: string) => rows[row].querySelector<HTMLElement>(`button[data-preset="${name}"]`)!
    expect(preset(1, '5')).toHaveAttribute('aria-pressed', 'true')
    expect(preset(0, '∞')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(preset(0, '50'))
    expect(dl()).toHaveValue('50')
    expect(preset(0, '50')).toHaveAttribute('aria-pressed', 'true')
    expect(preset(0, '∞')).toHaveAttribute('aria-pressed', 'false')
  })

  it('1,5 is sent as 1572864', async () => {
    const f = setup()
    render(<SpeedLimitsDialog tab="global" hashes={[]} onClose={() => {}} />)
    await waitFor(() => expect(up()).toHaveValue('5'))
    await userEvent.clear(dl())
    await userEvent.type(dl(), '1,5')
    await userEvent.click(apply())
    await waitFor(() => expect(posts(f, 'transfer/setDownloadLimit')).toHaveLength(1))
    expect(posts(f, 'transfer/setDownloadLimit')[0].get('limit')).toBe('1572864')
  })

  it('garbage shows a field error and disables the apply button', async () => {
    const f = setup()
    render(<SpeedLimitsDialog tab="global" hashes={[]} onClose={() => {}} />)
    await waitFor(() => expect(up()).toHaveValue('5'))
    await userEvent.clear(dl())
    await userEvent.type(dl(), 'abc')
    expect(dl()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Введите число, например 1.5')).toBeInTheDocument()
    expect(apply()).toBeDisabled()
    await userEvent.type(dl(), '{Enter}')
    expect(posts(f, 'transfer/setDownloadLimit')).toHaveLength(0)
  })

  it('fields use a decimal keyboard', async () => {
    setup()
    render(<SpeedLimitsDialog tab="global" hashes={[]} onClose={() => {}} />)
    expect(dl()).toHaveAttribute('inputmode', 'decimal')
    await waitFor(() => expect(up()).toHaveValue('5'))
  })

  it('warns when the global limit is below the torrent limit', async () => {
    setup({ torrents: { a: tor('a', { up_limit: 10 * MB }) } })
    render(<SpeedLimitsDialog tab="torrent" hashes={['a']} onClose={() => {}} />)
    expect(await screen.findByText('Глобальный лимит отдачи 5.00 МБ/с всё равно действует сверху.')).toBeInTheDocument()
  })

  it('compares with the alternative limit while alt mode is on', async () => {
    setup({ torrents: { a: tor('a', { dl_limit: 10 * MB }) }, server: { use_alt_speed_limits: true } })
    render(<SpeedLimitsDialog tab="torrent" hashes={['a']} onClose={() => {}} />)
    expect(await screen.findByText('Глобальный лимит загрузки 2.00 МБ/с всё равно действует сверху.')).toBeInTheDocument()
  })

  it('no warning when the global limit is higher', async () => {
    setup({ torrents: { a: tor('a', { up_limit: MB }) } })
    render(<SpeedLimitsDialog tab="torrent" hashes={['a']} onClose={() => {}} />)
    await waitFor(() => expect(up()).toHaveValue('1'))
    expect(screen.queryByText(/всё равно действует/)).toBeNull()
  })
})
