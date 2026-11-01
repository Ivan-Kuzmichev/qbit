// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubFetch, text } from '../../test/fetchStub'
import { LoginScreen } from './LoginScreen'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Логин'), 'admin')
  await user.type(screen.getByLabelText('Пароль'), 'secret')
}

describe('LoginScreen', () => {
  it('has fields for password managers', () => {
    render(<LoginScreen onSuccess={() => {}} />)
    expect(screen.getByLabelText('Логин')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('autocomplete', 'current-password')
  })
  it('shows the server address from location.host', () => {
    render(<LoginScreen onSuccess={() => {}} />)
    expect(screen.getByText(location.host)).toBeInTheDocument()
  })
  it('shows the app version under the card', () => {
    render(<LoginScreen onSuccess={() => {}} />)
    expect(screen.getByText(`qBit v${__APP_VERSION__}`)).toBeInTheDocument()
  })
  it('adds known qBittorrent and WebAPI versions from localStorage', () => {
    localStorage.setItem('qbit.versions', JSON.stringify({ app: 'v5.1.2', api: '2.11.2' }))
    render(<LoginScreen onSuccess={() => {}} />)
    expect(
      screen.getByText(`qBit v${__APP_VERSION__} · qBittorrent v5.1.2 · WebAPI 2.11.2`),
    ).toBeInTheDocument()
  })
  it('ignores broken stored versions', () => {
    localStorage.setItem('qbit.versions', '{oops')
    render(<LoginScreen onSuccess={() => {}} />)
    expect(screen.getByText(`qBit v${__APP_VERSION__}`)).toBeInTheDocument()
  })
  it('submits on Enter with username and password', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const fetchFn = stubFetch({ 'auth/login': () => text('Ok.') })
    render(<LoginScreen onSuccess={onSuccess} />)
    await fill(user)
    await user.keyboard('{Enter}')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(String(url)).toBe('api/v2/auth/login')
    expect(String(init?.body)).toBe('username=admin&password=secret')
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
  it('Fails. -> wrong credentials message', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    stubFetch({ 'auth/login': () => text('Fails.') })
    render(<LoginScreen onSuccess={onSuccess} />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль')
    expect(onSuccess).not.toHaveBeenCalled()
  })
  it('403 -> too many attempts message', async () => {
    const user = userEvent.setup()
    stubFetch({ 'auth/login': () => text('', 403) })
    render(<LoginScreen onSuccess={() => {}} />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Слишком много попыток, вход временно заблокирован',
    )
  })
  it('network failure -> connection message, not credentials', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')))
    render(<LoginScreen onSuccess={() => {}} />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером')
  })
  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<LoginScreen onSuccess={() => {}} />)
    const input = screen.getByLabelText('Пароль')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Показать пароль' }))
    expect(input).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Скрыть пароль' }))
    expect(input).toHaveAttribute('type', 'password')
  })
  it('does not submit twice while a request is pending', async () => {
    const user = userEvent.setup()
    let resolve!: (r: Response) => void
    const fetchFn = stubFetch({ 'auth/login': () => new Promise<Response>((r) => (resolve = r)) })
    render(<LoginScreen onSuccess={() => {}} />)
    await fill(user)
    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    resolve(text('Fails.'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
