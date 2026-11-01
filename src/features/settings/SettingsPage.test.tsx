// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { navigate, reloadPage } from '../../lib/router'
import { useUi } from '../../store/ui'
import { json, stubFetch, text, type Handler } from '../../test/fetchStub'
import { SettingsPage } from './SettingsPage'

vi.mock('../../lib/router', async (actual) => ({
  ...(await actual<typeof import('../../lib/router')>()),
  reloadPage: vi.fn(),
}))

const prefs = {
  save_path: '/downloads', temp_path_enabled: false, temp_path: '', add_stopped_enabled: false, auto_delete_mode: 0,
  max_ratio_enabled: true, max_ratio: 2, max_seeding_time_enabled: false, max_seeding_time: -1,
  listen_port: 8999, upnp: true, max_connec: 500, max_connec_per_torrent: 100, max_uploads: 20, max_uploads_per_torrent: 4,
  dl_limit: 0, up_limit: 5 * 1024 * 1024, alt_dl_limit: 1024, alt_up_limit: 1024,
  scheduler_enabled: false, schedule_from_hour: 8, schedule_from_min: 0, schedule_to_hour: 20, schedule_to_min: 30, scheduler_days: 0,
  dht: true, pex: true, lsd: true, encryption: 0, anonymous_mode: false,
  queueing_enabled: true, max_active_downloads: 3, max_active_uploads: 3, max_active_torrents: 5,
  web_ui_username: 'admin', bypass_local_auth: false, bypass_auth_subnet_whitelist_enabled: false,
  bypass_auth_subnet_whitelist: '', resolve_peer_countries: true,
  alternative_webui_enabled: true, alternative_webui_path: '/qbit',
  autorun_enabled: false, autorun_program: '',
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
const dirtyLabel = () => screen.queryByText('Есть несохранённые изменения')
const save = () => screen.getByRole('button', { name: 'Сохранить' })

async function open() {
  const user = userEvent.setup()
  render(<SettingsPage />)
  await screen.findByLabelText('Папка по умолчанию')
  return user
}

beforeEach(() => {
  location.hash = '#/settings'
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsPage', () => {
  it('shows the loaded values and starts clean', async () => {
    setup()
    await open()
    expect(screen.getByLabelText('Папка по умолчанию')).toHaveValue('/downloads')
    expect(dirtyLabel()).toBeNull()
    expect(save()).toBeDisabled()
  })

  it('sends only the changed keys, then is clean again', async () => {
    const f = setup()
    const user = await open()
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    expect(dirtyLabel()).toBeInTheDocument()
    await user.click(save())
    await waitFor(() => expect(dirtyLabel()).toBeNull())
    expect(sent(f)).toEqual([{ save_path: '/downloads/x' }])
  })

  it('"Сбросить" restores the original values', async () => {
    setup()
    const user = await open()
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    await user.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(screen.getByLabelText('Папка по умолчанию')).toHaveValue('/downloads')
    expect(dirtyLabel()).toBeNull()
  })

  it('a failed save keeps the draft', async () => {
    setup({ 'app/setPreferences': () => text('', 500) })
    const user = await open()
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    await user.click(save())
    await waitFor(() => expect(save()).toBeEnabled())
    expect(screen.getByLabelText('Папка по умолчанию')).toHaveValue('/downloads/x')
    expect(dirtyLabel()).toBeInTheDocument()
  })

  it('remembers the section in the hash', async () => {
    setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Скорость' }))
    expect(location.hash).toBe('#/settings/speed')
    expect(screen.getByLabelText('Лимит отдачи')).toBeInTheDocument()
  })

  it('a limit entered in KB/s is saved in bytes/s', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Скорость' }))
    expect(screen.getByLabelText('Лимит отдачи')).toHaveValue('5120')
    await user.type(screen.getByLabelText('Лимит загрузки'), '512')
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ dl_limit: 524288 }]))
  })

  it('ratio accepts a comma', async () => {
    const f = setup()
    const user = await open()
    const ratio = screen.getByLabelText('Ratio')
    await user.clear(ratio)
    await user.type(ratio, '2,5')
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ max_ratio: 2.5 }]))
  })

  it('switching ratio off sends only the switch', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('switch', { name: 'Останавливать при ratio' }))
    expect(screen.queryByLabelText('Ratio')).toBeNull()
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ max_ratio_enabled: false }]))
  })

  it('enabling ratio when the server stored -1 needs a value before saving', async () => {
    const f = setup({ 'app/preferences': () => json({ ...prefs, max_ratio_enabled: false, max_ratio: -1 }) })
    const user = await open()
    await user.click(screen.getByRole('switch', { name: 'Останавливать при ratio' }))
    expect(screen.getByLabelText('Ratio')).toHaveValue('')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(save()).toBeDisabled()
    await user.type(screen.getByLabelText('Ratio'), '2')
    expect(save()).toBeEnabled()
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ max_ratio_enabled: true, max_ratio: 2 }]))
  })

  it('switching it back off clears the block', async () => {
    setup({ 'app/preferences': () => json({ ...prefs, max_seeding_time_enabled: false, max_seeding_time: -1 }) })
    const user = await open()
    const sw = screen.getByRole('switch', { name: 'Останавливать после времени раздачи' })
    await user.click(sw)
    await user.click(sw)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a port outside 0-65535 blocks saving', async () => {
    setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Соединение' }))
    const port = screen.getByLabelText('Порт входящих соединений')
    await user.clear(port)
    await user.type(port, '70000')
    expect(save()).toBeDisabled()
    await user.clear(port)
    await user.type(port, '6881')
    expect(save()).toBeEnabled()
  })

  it('an empty password is not sent, a typed one is', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'WebUI' }))
    await user.clear(screen.getByLabelText('Логин'))
    await user.type(screen.getByLabelText('Логин'), 'me')
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ web_ui_username: 'me' }]))
    await user.type(screen.getByLabelText('Новый пароль'), 'pw')
    await user.click(save())
    await waitFor(() => expect(sent(f)[1]).toEqual({ web_ui_password: 'pw' }))
  })

  it('the accent applies at once, is stored locally and does not make the page dirty', async () => {
    setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Внешний вид' }))
    await user.click(screen.getByRole('radio', { name: '#A78BFA' }))
    expect(useUi.getState().accent).toBe('#A78BFA')
    expect(localStorage.getItem('qbit.accent')).toBe('#A78BFA')
    expect(dirtyLabel()).toBeNull()
    useUi.getState().setAccent('#60A5FA')
  })

  it('leaving with unsaved changes asks first', async () => {
    setup()
    const user = await open()
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    act(() => navigate('/'))
    const dialog = await screen.findByRole('dialog')
    expect(location.hash).toBe('#/settings')
    await user.click(screen.getByRole('button', { name: 'Остаться' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(location.hash).toBe('#/settings')
    expect(dialog).not.toBeInTheDocument()
    act(() => navigate('/'))
    await user.click(await screen.findByRole('button', { name: 'Уйти' }))
    await waitFor(() => expect(location.hash).toBe('#/'))
  })

  it('browser back/forward is guarded too: the old hash comes back', async () => {
    setup()
    const user = await open()
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    location.hash = '#/'
    await screen.findByRole('dialog')
    await waitFor(() => expect(location.hash).toBe('#/settings'))
    await user.click(screen.getByRole('button', { name: 'Уйти' }))
    await waitFor(() => expect(location.hash).toBe('#/'))
  })

  it('beforeunload is set only while dirty', async () => {
    setup()
    const user = await open()
    const probe = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(probe()).toBe(false)
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    expect(probe()).toBe(true)
  })

  it('moving between sections does not ask', async () => {
    setup()
    const user = await open()
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    await user.click(screen.getByRole('button', { name: 'Скорость' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('"Выйти" calls auth/logout', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'WebUI' }))
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await waitFor(() =>
      expect(f.mock.calls.some(([u, i]) => String(u).endsWith('auth/logout') && i?.method === 'POST')).toBe(true),
    )
  })
  it('"Выйти" with unsaved changes asks first; staying does not log out', async () => {
    const f = setup()
    const user = await open()
    await user.type(screen.getByLabelText('Папка по умолчанию'), '/x')
    await user.click(screen.getByRole('button', { name: 'WebUI' }))
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const loggedOut = () => f.mock.calls.some(([u]) => String(u).endsWith('auth/logout'))
    expect(loggedOut()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Остаться' }))
    expect(loggedOut()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await user.click(await screen.findByRole('button', { name: 'Уйти' }))
    await waitFor(() => expect(loggedOut()).toBe(true))
  })

  it('queue values edited before the queue was switched off are not sent', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'BitTorrent' }))
    const field = screen.getByLabelText('Активных загрузок')
    await user.clear(field)
    await user.type(field, '9')
    await user.click(screen.getByRole('switch', { name: 'Очередь торрентов' }))
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ queueing_enabled: false }]))
  })

  it('schedule times edited before the schedule was switched off are not sent', async () => {
    const f = setup({ 'app/preferences': () => json({ ...prefs, scheduler_enabled: true }) })
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Скорость' }))
    fireEvent.change(screen.getByLabelText('Начало'), { target: { value: '09:15' } })
    await user.click(screen.getByRole('switch', { name: 'Включать по расписанию' }))
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ scheduler_enabled: false }]))
  })

  it('port 0 is legal: it does not block saving on open', async () => {
    const f = setup({ 'app/preferences': () => json({ ...prefs, listen_port: 0 }) })
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Соединение' }))
    expect(screen.getByLabelText('Порт входящих соединений')).toHaveValue('0')
    await user.click(screen.getByRole('switch', { name: 'UPnP / NAT-PMP' }))
    expect(save()).toBeEnabled()
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ upnp: false }]))
  })

  it('turning the alternative WebUI off saves it and reloads into the standard interface', async () => {
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'WebUI' }))
    await user.click(screen.getByRole('switch', { name: 'Использовать альтернативный WebUI' }))
    expect(screen.queryByLabelText('Папка WebUI')).toBeNull()
    await user.click(save())
    await waitFor(() => expect(sent(f)).toEqual([{ alternative_webui_enabled: false }]))
    await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce(), { timeout: 2000 })
  })

  it('saving other settings does not reload', async () => {
    vi.mocked(reloadPage).mockClear()
    const f = setup()
    const user = await open()
    await user.click(screen.getByRole('switch', { name: 'Добавлять на паузе' }))
    await user.click(save())
    await waitFor(() => expect(sent(f)).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 900))
    expect(reloadPage).not.toHaveBeenCalled()
  })

  describe('Telegram', () => {
    const TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
    const openSection = async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole('button', { name: 'Уведомления' }))

    it('needs a valid token and chat, then saves the command and turns it on', async () => {
      const f = setup()
      const user = await open()
      await openSection(user)
      await user.click(screen.getByRole('switch', { name: 'Уведомлять о скачанных торрентах' }))
      await user.type(screen.getByLabelText('Токен бота'), '123')
      await user.type(screen.getByLabelText('Chat ID'), '42')
      expect(screen.getByRole('alert')).toHaveTextContent('Токен выглядит неверно')
      await user.clear(screen.getByLabelText('Токен бота'))
      await user.type(screen.getByLabelText('Токен бота'), TOKEN)
      await user.click(save())
      await waitFor(() => expect(sent(f)).toHaveLength(1))
      expect(sent(f)[0].autorun_enabled).toBe(true)
      expect(sent(f)[0].autorun_program).toContain(`/bot${TOKEN}/sendMessage -d chat_id=42 `)
    })

    it('shows no error before anything is typed, and nothing to save', async () => {
      setup()
      const user = await open()
      await openSection(user)
      await user.click(screen.getByRole('switch', { name: 'Уведомлять о скачанных торрентах' }))
      expect(screen.getByLabelText('Токен бота')).toHaveValue('')
      expect(screen.queryByRole('alert')).toBeNull()
      expect(save()).toBeDisabled()
    })

    it('warns before replacing another command and leaves it alone unless turned on', async () => {
      const foreign = { ...prefs, autorun_enabled: true, autorun_program: '/config/notify.sh "%N"' }
      setup({ 'app/preferences': () => json(foreign) })
      const user = await open()
      await openSection(user)
      expect(screen.getByRole('switch', { name: 'Уведомлять о скачанных торрентах' })).not.toBeChecked()
      expect(screen.getByText('/config/notify.sh "%N"')).toBeInTheDocument()
      expect(dirtyLabel()).toBeNull()
      const toggle = screen.getByRole('switch', { name: 'Уведомлять о скачанных торрентах' })
      await user.click(toggle)
      await user.type(screen.getByLabelText('Токен бота'), TOKEN)
      await user.type(screen.getByLabelText('Chat ID'), '42')
      expect(dirtyLabel()).not.toBeNull()
      await user.click(toggle)
      expect(dirtyLabel()).toBeNull()
    })

    it('reads back a saved command, and switching off keeps it', async () => {
      const program = `curl -s --max-time 30 -X POST https://api.telegram.org/bot${TOKEN}/sendMessage -d chat_id=42 --data-urlencode "text=Скачано: %N"`
      const f = setup({ 'app/preferences': () => json({ ...prefs, autorun_enabled: true, autorun_program: program }) })
      const user = await open()
      await openSection(user)
      expect(screen.getByLabelText('Chat ID')).toHaveValue('42')
      await user.click(screen.getByRole('switch', { name: 'Уведомлять о скачанных торрентах' }))
      await user.click(save())
      await waitFor(() => expect(sent(f)).toEqual([{ autorun_enabled: false }]))
    })
  })
})
