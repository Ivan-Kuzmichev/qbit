// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { json, stubFetch, text, type Handler } from '../../test/fetchStub'
import { MobileSettings } from './MobileSettings'

vi.mock('../../components/ui/Toast', () => ({ toast: vi.fn(), ToastHost: () => null }))

const prefs = {
  save_path: '/downloads', temp_path_enabled: true, temp_path: '/incomplete', add_stopped_enabled: false, auto_delete_mode: 0,
  max_ratio_enabled: true, max_ratio: 2, max_seeding_time_enabled: true, max_seeding_time: 1440,
  listen_port: 8999, upnp: true, max_connec: 500, max_connec_per_torrent: 100, max_uploads: 20, max_uploads_per_torrent: 4,
  dl_limit: 0, up_limit: 5 * 1024 * 1024, alt_dl_limit: 1024, alt_up_limit: 1024,
  scheduler_enabled: false, schedule_from_hour: 8, schedule_from_min: 0, schedule_to_hour: 20, schedule_to_min: 30, scheduler_days: 0,
  dht: true, pex: true, lsd: true, encryption: 0, anonymous_mode: false,
  queueing_enabled: true, max_active_downloads: 3, max_active_uploads: 3, max_active_torrents: 5,
  web_ui_username: 'admin', bypass_local_auth: false, bypass_auth_subnet_whitelist_enabled: false,
  bypass_auth_subnet_whitelist: '', resolve_peer_countries: true,
}

function setup(extra: Record<string, Handler> = {}) {
  return stubFetch({
    'app/preferences': () => json(prefs),
    'app/setPreferences': () => text(''),
    'auth/logout': () => text(''),
    ...extra,
  })
}
const sent = (f: ReturnType<typeof stubFetch>) =>
  f.mock.calls
    .filter(([u]) => String(u).endsWith('app/setPreferences'))
    .map(([, i]) => JSON.parse(new URLSearchParams(String(i?.body)).get('json')!))
const save = () => screen.getByRole('button', { name: 'Сохранить' })

async function open(hash = '#/settings') {
  location.hash = hash
  const user = userEvent.setup()
  render(<MobileSettings />)
  await screen.findByRole('switch', { name: 'Добавлять на паузе' })
  return user
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MobileSettings', () => {
  it('shows the groups and rows of the mockup', async () => {
    setup()
    await open()
    for (const g of ['Сохранение', 'Скорость', 'Раздача', 'Ещё']) expect(screen.getByText(g)).toBeInTheDocument()
    for (const name of ['Папка по умолчанию', 'Лимит загрузки', 'Лимит отдачи', 'Остановить при ratio', 'Время раздачи', 'Соединение', 'BitTorrent', 'WebUI', 'Внешний вид']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument()
    }
    for (const name of ['Папка для незавершённых', 'Добавлять на паузе', 'Лимиты по расписанию']) {
      expect(screen.getByRole('switch', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
  })

  it('shows current values next to the rows', async () => {
    setup()
    await open()
    expect(screen.getByRole('button', { name: /Папка по умолчанию/ })).toHaveTextContent('/downloads')
    expect(screen.getByRole('button', { name: /Лимит загрузки/ })).toHaveTextContent('∞')
    expect(screen.getByRole('button', { name: /Лимит отдачи/ })).toHaveTextContent('5 МБ/с')
    expect(screen.getByRole('button', { name: /Остановить при ratio/ })).toHaveTextContent('2.0')
    expect(screen.getByRole('button', { name: /Время раздачи/ })).toHaveTextContent('24 ч')
  })

  it('starts clean and a switch changes the draft', async () => {
    setup()
    const user = await open()
    expect(save()).toBeDisabled()
    await user.click(screen.getByRole('switch', { name: 'Добавлять на паузе' }))
    expect(screen.getByRole('switch', { name: 'Добавлять на паузе' })).toBeChecked()
    expect(save()).toBeEnabled()
  })

  it('has the delete-.torrent switch, saved as 0/1', async () => {
    const f = setup()
    const user = await open()
    const sw = screen.getByRole('switch', { name: 'Удалять .torrent после добавления' })
    expect(sw).not.toBeChecked()
    await user.click(sw)
    expect(sw).toBeChecked()
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ auto_delete_mode: 1 }]))
  })

  it('a tap on a value opens a sheet; Готово keeps the edit and Сохранить sends only that', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Папка по умолчанию/ }))
    const sheet = screen.getByRole('dialog')
    const field = within(sheet).getByLabelText('Папка по умолчанию')
    await user.clear(field)
    await user.type(field, '/data')
    await user.click(within(sheet).getByRole('button', { name: 'Готово' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /Папка по умолчанию/ })).toHaveTextContent('/data')
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ save_path: '/data' }]))
  })

  it('Отмена in the sheet discards the edit', async () => {
    setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Папка по умолчанию/ }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Папка по умолчанию'), '/x')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }))
    expect(screen.getByRole('button', { name: /Папка по умолчанию/ })).toHaveTextContent('/downloads')
    expect(save()).toBeDisabled()
  })

  it('a speed limit is typed in KB/s and sent in bytes/s; Готово waits for a valid value', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Лимит загрузки/ }))
    const sheet = screen.getByRole('dialog')
    const field = within(sheet).getByLabelText('Лимит загрузки')
    await user.type(field, 'abc')
    expect(within(sheet).getByRole('button', { name: 'Готово' })).toBeDisabled()
    await user.clear(field)
    await user.type(field, '512')
    await user.click(within(sheet).getByRole('button', { name: 'Готово' }))
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ dl_limit: 524288 }]))
  })

  it('the ratio sheet holds the switch and the number', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Остановить при ratio/ }))
    const sheet = screen.getByRole('dialog')
    await user.click(within(sheet).getByRole('switch', { name: 'Останавливать при ratio' }))
    await user.click(within(sheet).getByRole('button', { name: 'Готово' }))
    expect(screen.getByRole('button', { name: /Остановить при ratio/ })).toHaveTextContent('Выкл')
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ max_ratio_enabled: false }]))
  })

  it('"Ещё" opens a full-screen list for a section and back returns', async () => {
    setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Соединение/ }))
    expect(location.hash).toBe('#/settings/connection')
    expect(screen.getByRole('heading', { name: 'Соединение' })).toBeInTheDocument()
    expect(screen.getByLabelText('Порт входящих соединений')).toHaveValue('8999')
    await user.click(screen.getByRole('button', { name: 'Назад' }))
    expect(location.hash).toBe('#/settings')
    expect(screen.getByRole('heading', { name: 'Настройки' })).toBeInTheDocument()
  })

  it('edits made in a section survive going back and are saved', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Соединение/ }))
    await user.click(screen.getByRole('switch', { name: 'UPnP / NAT-PMP' }))
    await user.click(screen.getByRole('button', { name: 'Назад' }))
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ upnp: false }]))
  })

  it('has the accent picker under "Внешний вид"', async () => {
    setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: /Внешний вид/ }))
    expect(screen.getByRole('radiogroup', { name: 'Акцентный цвет' })).toBeInTheDocument()
  })

  it('"Выйти" logs out; with unsaved changes it asks first', async () => {
    const f = setup()
    const user = await open()
    const loggedOut = () => f.mock.calls.some(([u]) => String(u).endsWith('auth/logout'))
    await user.click(screen.getByRole('switch', { name: 'Добавлять на паузе' }))
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(loggedOut()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Остаться' }))
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await user.click(await screen.findByRole('button', { name: 'Уйти' }))
    await waitFor(() => expect(loggedOut()).toBe(true))
  })

  it('"Выйти" without changes logs out at once', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).endsWith('auth/logout'))).toBe(true))
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => {})
  })
})
