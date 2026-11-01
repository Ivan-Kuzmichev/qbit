// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { setOnForbidden } from './api/client'
import { emptySync } from './store/mergeMainData'
import { useTorrents } from './store/torrents'
import { json, stubFetch, text, type Handler } from './test/fetchStub'

const ok: Record<string, Handler> = {
  'app/version': () => text('v5.1.2'),
  'app/webapiVersion': () => text('2.11.2'),
  'sync/maindata': () => json({ rid: 1, full_update: true }),
}

beforeEach(() => {
  location.hash = ''
  localStorage.clear()
})
afterEach(() => {
  useTorrents.getState().stopSync()
  useTorrents.setState({ ...emptySync, connection: 'ok' })
  setOnForbidden(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('App boot', () => {
  it('API 2.11 -> interface, and stores versions for the login footer', async () => {
    stubFetch(ok)
    render(<App />)
    expect(await screen.findByRole('main')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('qbit.versions')!)).toEqual({
      app: 'v5.1.2',
      api: '2.11.2',
    })
  })
  it('403 on app/version -> login screen', async () => {
    stubFetch({ ...ok, 'app/version': () => text('Forbidden', 403) })
    render(<App />)
    expect(await screen.findByRole('form', { name: 'Вход' })).toBeInTheDocument()
  })
  it('API 2.9.3 -> upgrade screen with the version', async () => {
    stubFetch({ ...ok, 'app/version': () => text('v4.6.7'), 'app/webapiVersion': () => text('2.9.3') })
    render(<App />)
    expect(await screen.findByText('Нужен qBittorrent 5.0 или новее')).toBeInTheDocument()
    expect(screen.getByText(/v4\.6\.7/)).toBeInTheDocument()
    expect(screen.getByText(/2\.9\.3/)).toBeInTheDocument()
    expect(screen.queryByRole('main')).toBeNull()
  })
  it('network error at start -> retry screen, then interface after the server returns', async () => {
    vi.useFakeTimers()
    let up = false
    stubFetch({
      ...ok,
      'app/version': () => {
        if (!up) throw new TypeError('down')
        return text('v5.1.2')
      },
    })
    render(<App />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Нет соединения, повторяем…')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Вход' })).toBeNull()
    // same centered card as the login screen, not a bare div
    expect(screen.getByRole('status').closest('[class*="card"]')).not.toBeNull()
    up = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})

describe('session expiry', () => {
  it('403 while running -> login, hash kept, sync stopped; after login the same screen is back', async () => {
    const user = userEvent.setup()
    location.hash = '#/settings'
    let expired = false
    const fetchFn = stubFetch({
      ...ok,
      'sync/maindata': () => (expired ? text('', 403) : json({ rid: 1, full_update: true })),
      'auth/login': () => {
        expired = false
        return text('Ok.')
      },
    })
    render(<App />)
    await screen.findByRole('main')
    expired = true
    expect(await screen.findByRole('form', { name: 'Вход' })).toBeInTheDocument()
    expect(location.hash).toBe('#/settings')
    const syncCalls = () => fetchFn.mock.calls.filter(([u]) => String(u).includes('sync/maindata')).length
    const before = syncCalls()
    await new Promise((r) => setTimeout(r, 1300))
    expect(syncCalls()).toBe(before)

    await user.type(screen.getByLabelText('Логин'), 'a')
    await user.type(screen.getByLabelText('Пароль'), 'b')
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('main')).toBeInTheDocument()
    expect(location.hash).toBe('#/settings')
    await vi.waitFor(() => expect(syncCalls()).toBeGreaterThan(before))
  })
})

describe('connection banner', () => {
  it('shows while connection is lost', async () => {
    stubFetch(ok)
    render(<App />)
    await screen.findByRole('main')
    expect(screen.queryByText('Нет соединения, повторяем…')).toBeNull()
    act(() => useTorrents.setState({ connection: 'lost' }))
    expect(screen.getByRole('status')).toHaveTextContent('Нет соединения, повторяем…')
  })
})

describe('settings route', () => {
  it('renders the settings page; "Выйти" returns to login', async () => {
    location.hash = '#/settings/webui'
    const user = userEvent.setup()
    stubFetch({
      ...ok,
      'app/preferences': () => json({ web_ui_username: 'admin' }),
      'auth/logout': () => text(''),
    })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Выйти' }))
    expect(await screen.findByRole('form', { name: 'Вход' })).toBeInTheDocument()
  })
})
