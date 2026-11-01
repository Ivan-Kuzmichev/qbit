// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { json, stubFetch, text } from '../../test/fetchStub'
import { MobileAddSheet } from './MobileAddSheet'

vi.mock('../../components/ui/Toast', () => ({ toast: vi.fn(), ToastHost: () => null }))

let fetchMock: ReturnType<typeof stubFetch>
beforeEach(() => {
  useTorrents.setState({ ...emptySync, categories: { Софт: { name: 'Софт', savePath: '/soft' } }, refresh: vi.fn().mockResolvedValue(undefined) })
  fetchMock = stubFetch({
    'app/preferences': () => json({ save_path: '/downloads' }),
    'torrents/add': () => text('Ok.'),
    'torrents/info': () => json([]),
  })
})
afterEach(() => vi.unstubAllGlobals())

const bodyOf = () => fetchMock.mock.calls.find(([u]) => String(u).includes('torrents/add'))![1]!.body as FormData

describe('MobileAddSheet', () => {
  it('opens on the requested tab with Файл / Magnet', () => {
    render(<MobileAddSheet tab="magnet" files={[]} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Добавить торрент' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Magnet' })).toBeChecked()
    expect(screen.getByLabelText('Magnet-ссылки')).toBeInTheDocument()
  })

  it('Добавить is disabled until a link is typed, then posts the magnet with the options', async () => {
    const onClose = vi.fn()
    render(<MobileAddSheet tab="magnet" files={[]} onClose={onClose} />)
    const add = screen.getByRole('button', { name: 'Добавить' })
    expect(add).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Magnet-ссылки'), 'magnet:?xt=urn:btih:aaaa')
    await waitFor(() => expect(screen.getByLabelText('Папка сохранения')).toHaveValue('/downloads'))
    await userEvent.click(screen.getByRole('switch', { name: 'Последовательная загрузка' }))
    await userEvent.click(add)
    expect(onClose).toHaveBeenCalled()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('torrents/add'))).toBe(true))
    const form = bodyOf()
    expect(form.get('urls')).toBe('magnet:?xt=urn:btih:aaaa')
    expect(form.get('sequentialDownload')).toBe('true')
    expect(form.get('savepath')).toBe('/downloads')
  })

  it('has the three option switches of the mockup, "Запустить сразу" on', () => {
    render(<MobileAddSheet tab="magnet" files={[]} onClose={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Запустить сразу' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Последовательная загрузка' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Сначала первые и последние части' })).not.toBeChecked()
  })

  it('choosing a category fills in its folder', async () => {
    render(<MobileAddSheet tab="magnet" files={[]} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Категория/ }))
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Софт' }))
    expect(screen.getByLabelText('Папка сохранения')).toHaveValue('/soft')
  })

  it('Отмена closes without posting', async () => {
    const onClose = vi.fn()
    render(<MobileAddSheet tab="file" files={[]} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onClose).toHaveBeenCalled()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('torrents/add'))).toBe(false)
  })
})
