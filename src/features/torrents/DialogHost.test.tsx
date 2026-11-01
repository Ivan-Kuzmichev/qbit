// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDialogs } from '../../store/dialogs'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { json, stubFetch } from '../../test/fetchStub'
import { DialogHost } from './DialogHost'

vi.mock('../../components/ui/Toast', () => ({ toast: vi.fn(), ToastHost: () => null }))

function media(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches, addEventListener: () => {}, removeEventListener: () => {} }))
}

afterEach(() => {
  useDialogs.setState({ open: null })
  vi.unstubAllGlobals()
})

describe('DialogHost per-open state', () => {
  it('opening the delete dialog again while open resets the checkbox', () => {
    stubFetch({})
    media(false)
    useTorrents.setState({ ...emptySync, torrents: { a: { hash: 'a', name: 'A', completed: 1 } as never } })
    render(<DialogHost />)
    act(() => useDialogs.getState().openDelete(['a']))
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()
    act(() => useDialogs.getState().openDelete(['a']))
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })
})

describe('DialogHost add dialog', () => {
  it('is the bottom sheet on a phone (Файл / Magnet)', () => {
    stubFetch({ 'app/preferences': () => json({}) })
    media(true)
    render(<DialogHost />)
    act(() => useDialogs.getState().openAdd('magnet'))
    expect(screen.getByRole('radio', { name: 'Magnet' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Magnet-ссылка' })).toBeNull()
  })

  it('is the desktop dialog otherwise', () => {
    stubFetch({ 'app/preferences': () => json({}) })
    media(false)
    render(<DialogHost />)
    act(() => useDialogs.getState().openAdd('magnet'))
    expect(screen.getByRole('radio', { name: 'Magnet-ссылка' })).toBeChecked()
  })
})
