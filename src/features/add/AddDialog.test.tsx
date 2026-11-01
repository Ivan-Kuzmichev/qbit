// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDialogs } from '../../store/dialogs'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { json, stubFetch, text } from '../../test/fetchStub'
import { DialogHost } from '../torrents/DialogHost'
import { AddDialog } from './AddDialog'
import { DropOverlay } from './DropOverlay'
import { multiInfo, sha1hex, singleInfo, torrentBytes } from './torrentFixtures'

function torrentFile(name: string, info: object = multiInfo): File {
  return new File([torrentBytes(info as never).bytes as BlobPart], name, { type: 'application/x-bittorrent' })
}
const bad = () => new File([new TextEncoder().encode('garbage') as BlobPart], 'broken.torrent')

function routes(over: Record<string, () => Response> = {}) {
  return stubFetch({
    'app/preferences': () => json({ save_path: '/default/path' }),
    'torrents/add': () => text('Ok.'),
    'torrents/createCategory': () => text(''),
    'torrents/info': () => json([]),
    ...over,
  })
}
const form = (f: ReturnType<typeof stubFetch>, path: string) => {
  const call = f.mock.calls.find((c) => String(c[0]).includes(path))
  expect(call, `request to ${path}`).toBeDefined()
  return call![1]!.body as FormData
}
const added = (f: ReturnType<typeof stubFetch>) => f.mock.calls.filter((c) => String(c[0]).includes('torrents/add'))

beforeEach(() => {
  useTorrents.setState({
    ...emptySync,
    categories: { Софт: { name: 'Софт', savePath: '/soft' } },
    tags: ['linux', 'iso'],
    server: { free_space_on_disk: 2 * 1024 ** 4 } as never,
    refresh: vi.fn().mockResolvedValue(undefined),
  })
})
afterEach(() => {
  useTorrents.setState({ ...emptySync })
  useDialogs.setState({ open: null })
  vi.unstubAllGlobals()
})

describe('AddDialog', () => {
  it('opens on the requested tab', () => {
    routes()
    const { unmount } = render(<AddDialog tab="file" files={[]} onClose={() => {}} />)
    expect(screen.getByText('Можно несколько сразу')).toBeInTheDocument()
    expect(screen.queryByLabelText('Magnet-ссылки')).toBeNull()
    unmount()
    render(<AddDialog tab="magnet" files={[]} onClose={() => {}} />)
    expect(screen.getByLabelText('Magnet-ссылки')).toBeInTheDocument()
  })

  it('magnet: one link per line, blank lines dropped', async () => {
    const f = routes()
    const onClose = vi.fn()
    render(<AddDialog tab="magnet" files={[]} onClose={onClose} />)
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Magnet-ссылки'), 'magnet:?xt=urn:btih:aa\n\n  \nmagnet:?xt=urn:btih:bb\n')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    expect(onClose).toHaveBeenCalled()
    await waitFor(() => expect(added(f)).toHaveLength(1))
    expect(form(f, 'torrents/add').get('urls')).toBe('magnet:?xt=urn:btih:aa\nmagnet:?xt=urn:btih:bb')
  })

  it('a corrupt file shows an error and does not block the others', async () => {
    const f = routes()
    render(<AddDialog tab="file" files={[bad(), torrentFile('ok.torrent', singleInfo)]} onClose={() => {}} />)
    expect(await screen.findByText('ok.torrent')).toBeInTheDocument()
    expect(screen.getByText('broken.torrent')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось прочитать файл')
    const submit = screen.getByRole('button', { name: 'Добавить' })
    expect(submit).toBeEnabled()
    await userEvent.click(submit)
    await waitFor(() => expect(added(f)).toHaveLength(1))
    expect((form(f, 'torrents/add').get('torrents') as File).name).toBe('ok.torrent')
  })

  it('unchecking every file disables Add; a partial selection adds stopped', async () => {
    const f = routes()
    render(<AddDialog tab="file" files={[torrentFile('m.torrent')]} onClose={() => {}} />)
    await screen.findByText('выбрано 3 из 3')
    const boxes = screen.getAllByRole('checkbox', { name: /(a\.txt|b\.txt|c\.bin)/ })
    expect(boxes).toHaveLength(3)
    for (const b of boxes) await userEvent.click(b)
    expect(screen.getByText('выбрано 0 из 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled()
    await userEvent.click(boxes[1])
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    await waitFor(() => expect(added(f)).toHaveLength(1))
    expect(form(f, 'torrents/add').get('stopped')).toBe('true')
  })

  it('save path: default from settings, category path on select', async () => {
    routes()
    render(<AddDialog tab="magnet" files={[]} onClose={() => {}} />)
    const path = screen.getByLabelText('Папка сохранения')
    await waitFor(() => expect(path).toHaveValue('/default/path'))
    await userEvent.click(screen.getByRole('button', { name: /Категория/ }))
    await userEvent.click(screen.getByRole('option', { name: 'Софт' }))
    expect(path).toHaveValue('/soft')
    await userEvent.click(screen.getByRole('button', { name: /Категория/ }))
    await userEvent.click(screen.getByRole('option', { name: 'Без категории' }))
    expect(path).toHaveValue('/default/path')
  })

  it('does not overwrite a path the user typed with the late settings response', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    stubFetch({ 'app/preferences': async () => (await gate, json({ save_path: '/late' })) })
    render(<AddDialog tab="magnet" files={[]} onClose={() => {}} />)
    await userEvent.type(screen.getByLabelText('Папка сохранения'), '/mine')
    release()
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByLabelText('Папка сохранения')).toHaveValue('/mine')
  })

  it('stays empty when settings cannot be read', async () => {
    stubFetch({ 'app/preferences': () => text('', 500) })
    render(<AddDialog tab="magnet" files={[]} onClose={() => {}} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByLabelText('Папка сохранения')).toHaveValue('')
  })

  it('a new category is created through the API and selected', async () => {
    const f = routes()
    render(<AddDialog tab="magnet" files={[]} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Категория/ }))
    await userEvent.click(screen.getByRole('option', { name: 'Новая категория…' }))
    await userEvent.type(screen.getByLabelText('Название новой категории'), 'Кино')
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
    await waitFor(() => expect(form(f, 'torrents/createCategory')).toBeDefined())
    const call = f.mock.calls.find((c) => String(c[0]).includes('createCategory'))!
    expect(new URLSearchParams(String(call[1]!.body)).get('category')).toBe('Кино')
    expect(await screen.findByRole('button', { name: /Категория.*Кино/ })).toBeInTheDocument()
  })

  it('tags become chips and are sent comma-separated; options map to flags', async () => {
    const f = routes()
    render(<AddDialog tab="magnet" files={[]} onClose={() => {}} />)
    await userEvent.type(screen.getByLabelText('Magnet-ссылки'), 'magnet:?xt=urn:btih:aa')
    await userEvent.type(screen.getByLabelText('Теги'), 'linux{Enter}new,')
    expect(screen.getByText('new')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Запустить сразу' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Пропустить проверку хеша' }))
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    await waitFor(() => expect(added(f)).toHaveLength(1))
    const body = form(f, 'torrents/add')
    expect(body.get('tags')).toBe('linux,new')
    expect(body.get('stopped')).toBe('true')
    expect(body.get('skip_checking')).toBe('true')
  })

  it('shows free space at the bottom', () => {
    routes()
    render(<AddDialog tab="magnet" files={[]} onClose={() => {}} />)
    expect(screen.getByText('Свободно 2.00 ТБ')).toBeInTheDocument()
  })

  it('removing a file card drops it', async () => {
    routes()
    render(<AddDialog tab="file" files={[torrentFile('one.torrent', singleInfo)]} onClose={() => {}} />)
    const card = (await screen.findByText('one.torrent')).closest('li')!
    await userEvent.click(within(card).getByRole('button', { name: 'Убрать файл' }))
    expect(screen.queryByText('one.torrent')).toBeNull()
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled()
  })
})

describe('AddDialog selection rules', () => {
  it('filePrio indices skip padding files', async () => {
    const pieces = new Uint8Array(20).fill(7)
    const info = {
      files: [
        { length: 10, path: ['a'] },
        { length: 5, path: ['.pad', '5'], attr: 'p' },
        { length: 20, path: ['b'] },
        { length: 5, path: ['.pad', '6'], attr: 'p' },
        { length: 30, path: ['c'] },
      ],
      name: 'padded',
      'piece length': 16384,
      pieces,
    }
    const { bytes, infoBytes } = torrentBytes(info as never)
    const hash = sha1hex(infoBytes)
    const f = routes({
      'torrents/info': () => json([{ hash }]),
      'torrents/filePrio': () => text(''),
      'torrents/start': () => text(''),
    })
    render(<AddDialog tab="file" files={[new File([bytes as BlobPart], 'p.torrent')]} onClose={() => {}} />)
    await screen.findByText('выбрано 3 из 3')
    await userEvent.click(screen.getByRole('checkbox', { name: /padded\/b/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    await waitFor(() => expect(f.mock.calls.some((c) => String(c[0]).includes('filePrio'))).toBe(true))
    const call = f.mock.calls.find((c) => String(c[0]).includes('filePrio'))!
    expect(new URLSearchParams(String(call[1]!.body)).get('id')).toBe('1')
  })

  it('with several torrents the hidden selections are not sent: each is added whole', async () => {
    const f = routes()
    render(<AddDialog tab="file" files={[torrentFile('m.torrent')]} onClose={() => {}} />)
    await screen.findByText('выбрано 3 из 3')
    await userEvent.click(screen.getByRole('checkbox', { name: /a\.txt/ }))
    await userEvent.upload(screen.getByTestId('file-input'), torrentFile('two.torrent', singleInfo))
    await screen.findByText('two.torrent')
    expect(screen.queryByText(/выбрано/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    await waitFor(() => expect(added(f)).toHaveLength(2))
    for (const c of added(f)) expect((c[1]!.body as FormData).get('stopped')).toBe('false')
    expect(f.mock.calls.some((c) => String(c[0]).includes('filePrio'))).toBe(false)
  })
})

describe('drag and drop', () => {
  function drop(items: { files?: File[]; types: string[] }) {
    const dataTransfer = { types: items.types, files: items.files ?? [], dropEffect: 'none' }
    fireEvent.dragEnter(document.body, { dataTransfer })
    fireEvent.drop(document.body, { dataTransfer })
  }

  it('a dropped .torrent opens the dialog on the file tab', async () => {
    routes()
    render(
      <>
        <DropOverlay />
        <DialogHost />
      </>,
    )
    drop({ files: [torrentFile('d.torrent', singleInfo)], types: ['Files'] })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('d.torrent')).toBeInTheDocument()
  })

  it('dropped text does not', () => {
    routes()
    render(
      <>
        <DropOverlay />
        <DialogHost />
      </>,
    )
    drop({ types: ['text/plain'] })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('other files are ignored', () => {
    routes()
    render(<DropOverlay />)
    drop({ files: [new File(['x'], 'pic.png')], types: ['Files'] })
    expect(useDialogs.getState().open).toBeNull()
  })
})
