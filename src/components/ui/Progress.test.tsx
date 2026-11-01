// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Progress } from './Progress'

describe('Progress', () => {
  it('exposes the value as a progressbar in percent', () => {
    render(<Progress value={0.456} tone="accent" height={12} aria-label="Прогресс" />)
    const bar = screen.getByRole('progressbar', { name: 'Прогресс' })
    expect(bar).toHaveAttribute('aria-valuenow', '46')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })
  it('clamps out-of-range and NaN values', () => {
    const { rerender } = render(<Progress value={1.7} tone="done" height={10} aria-label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<Progress value={-1} tone="done" height={10} aria-label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    rerender(<Progress value={NaN} tone="dim" height={10} aria-label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
  it('sets height, fill width and tone', () => {
    render(<Progress value={0.5} tone="dim" height={14} aria-label="p" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveStyle({ height: '14px' })
    expect(bar.dataset.tone).toBe('dim')
    expect(bar.firstElementChild).toHaveStyle({ width: '50%' })
  })
})
