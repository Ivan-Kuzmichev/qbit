// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from './useLongPress'

const down = (x = 10, y = 10) =>
  ({ clientX: x, clientY: y, button: 0, target: document.body }) as unknown as ReactPointerEvent
const move = (x: number, y: number) => ({ clientX: x, clientY: y }) as unknown as ReactPointerEvent
const click = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useLongPress', () => {
  it('fires after 500 ms of holding', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb))
    act(() => result.current.onPointerDown(down()))
    act(() => void vi.advanceTimersByTime(499))
    expect(cb).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(document.body)
  })

  it('honours a custom delay', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb, 200))
    act(() => result.current.onPointerDown(down()))
    act(() => void vi.advanceTimersByTime(200))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('is cancelled by a release before the delay', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb))
    act(() => result.current.onPointerDown(down()))
    act(() => void vi.advanceTimersByTime(300))
    act(() => result.current.onPointerUp())
    act(() => void vi.advanceTimersByTime(1000))
    expect(cb).not.toHaveBeenCalled()
  })

  it('is cancelled by a move of more than 10px', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb))
    act(() => result.current.onPointerDown(down(10, 10)))
    act(() => result.current.onPointerMove(move(10, 21)))
    act(() => void vi.advanceTimersByTime(1000))
    expect(cb).not.toHaveBeenCalled()
  })

  it('survives a move of 10px or less', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useLongPress(cb))
    act(() => result.current.onPointerDown(down(10, 10)))
    act(() => result.current.onPointerMove(move(16, 18)))
    act(() => void vi.advanceTimersByTime(500))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('swallows the click that follows a long press, but not the next one', () => {
    const { result } = renderHook(() => useLongPress(vi.fn()))
    act(() => result.current.onPointerDown(down()))
    act(() => void vi.advanceTimersByTime(500))
    act(() => result.current.onPointerUp())
    const first = click()
    result.current.onClickCapture(first as never)
    expect(first.preventDefault).toHaveBeenCalled()
    expect(first.stopPropagation).toHaveBeenCalled()
    const second = click()
    result.current.onClickCapture(second as never)
    expect(second.preventDefault).not.toHaveBeenCalled()
  })

  it('lets a plain tap click through', () => {
    const { result } = renderHook(() => useLongPress(vi.fn()))
    act(() => result.current.onPointerDown(down()))
    act(() => result.current.onPointerUp())
    const e = click()
    result.current.onClickCapture(e as never)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('suppresses the browser context menu', () => {
    const { result } = renderHook(() => useLongPress(vi.fn()))
    const e = { preventDefault: vi.fn() }
    result.current.onContextMenu(e as never)
    expect(e.preventDefault).toHaveBeenCalled()
  })
})
