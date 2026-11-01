// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDialogs } from '../store/dialogs'
import { useHotkeys } from './useHotkeys'

afterEach(() => {
  useDialogs.setState({ open: null })
  document.body.innerHTML = ''
})

function setup(anywhere = false) {
  const run = vi.fn()
  renderHook(() => useHotkeys([{ keys: ['ArrowDown'], run }, { keys: ['/'], run: vi.fn(), anywhere }, { keys: ['Delete', 'Backspace'], run }]))
  return run
}

describe('useHotkeys', () => {
  it('runs the handler for a bound key on the page body', () => {
    const run = setup()
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('Delete and Backspace (the Mac delete key) are the same binding', () => {
    const run = setup()
    fireEvent.keyDown(document.body, { key: 'Delete' })
    fireEvent.keyDown(document.body, { key: 'Backspace' })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('acts when focus is on a grid row', () => {
    const run = setup()
    document.body.innerHTML = '<div role="grid"><div role="row" tabindex="-1" id="r"></div></div>'
    const row = document.getElementById('r')!
    row.focus()
    fireEvent.keyDown(row, { key: 'ArrowDown' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('leaves keys alone while typing in a field', () => {
    const run = setup()
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.body.appendChild(document.createElement(tag))
      el.focus()
      fireEvent.keyDown(el, { key: 'Backspace' })
    }
    const editable = document.body.appendChild(document.createElement('div'))
    editable.setAttribute('contenteditable', 'true')
    editable.focus()
    fireEvent.keyDown(editable, { key: 'Backspace' })
    expect(run).not.toHaveBeenCalled()
  })

  it('leaves keys alone when an inner button has focus: it keeps its native meaning', () => {
    const run = setup()
    const btn = document.body.appendChild(document.createElement('button'))
    btn.focus()
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(run).not.toHaveBeenCalled()
  })

  it('ignores chords with Ctrl, Meta or Alt', () => {
    const run = setup()
    fireEvent.keyDown(document.body, { key: 'ArrowDown', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'ArrowDown', metaKey: true })
    fireEvent.keyDown(document.body, { key: 'ArrowDown', altKey: true })
    expect(run).not.toHaveBeenCalled()
  })

  it('an "anywhere" key does not steal focus while a menu popup is open', () => {
    const run = vi.fn()
    renderHook(() => useHotkeys([{ keys: ['/'], run, anywhere: true }]))
    document.body.innerHTML = '<div role="menu"><button role="menuitem" id="i">x</button></div>'
    const item = document.getElementById('i')!
    item.focus()
    fireEvent.keyDown(item, { key: '/' })
    expect(run).not.toHaveBeenCalled()
  })

  it('does nothing while a dialog is open', () => {
    const run = setup()
    useDialogs.getState().openDelete(['a'])
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(run).not.toHaveBeenCalled()
  })

  it('does nothing while a modal dialog is in the page, even one not from the store', () => {
    const run = setup()
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>'
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(run).not.toHaveBeenCalled()
  })

  it('an "anywhere" binding also fires from a button, but never in a field', () => {
    const run = vi.fn()
    renderHook(() => useHotkeys([{ keys: ['/'], run, anywhere: true }]))
    const btn = document.body.appendChild(document.createElement('button'))
    btn.focus()
    fireEvent.keyDown(btn, { key: '/' })
    expect(run).toHaveBeenCalledTimes(1)
    const input = document.body.appendChild(document.createElement('input'))
    input.focus()
    fireEvent.keyDown(input, { key: '/' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('prevents the default action of a handled key (no page scroll on Space)', () => {
    const run = vi.fn()
    renderHook(() => useHotkeys([{ keys: [' '], run }]))
    const notPrevented = fireEvent.keyDown(document.body, { key: ' ' })
    expect(notPrevented).toBe(false)
  })

  it('removes its listener on unmount', () => {
    const run = vi.fn()
    const { unmount } = renderHook(() => useHotkeys([{ keys: ['ArrowDown'], run }]))
    unmount()
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(run).not.toHaveBeenCalled()
  })

  it('a binding with codes also fires for the physical key (Russian layout sends "." for "/")', () => {
    const run = vi.fn()
    renderHook(() => useHotkeys([{ keys: ['/'], codes: ['Slash'], run }]))
    fireEvent.keyDown(document.body, { key: '.', code: 'Slash' })
    expect(run).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.body, { key: '.', code: 'Period' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('noRepeat ignores auto-repeat but still blocks the default action', () => {
    const run = vi.fn()
    renderHook(() => useHotkeys([{ keys: [' '], noRepeat: true, run }]))
    fireEvent.keyDown(document.body, { key: ' ' })
    const notPrevented = fireEvent.keyDown(document.body, { key: ' ', repeat: true })
    expect(run).toHaveBeenCalledTimes(1)
    expect(notPrevented).toBe(false)
  })
})
