// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Segmented } from './Segmented'

const options = [
  { id: 'a', label: 'Один' },
  { id: 'b', label: 'Два', disabled: true },
  { id: 'c', label: 'Три' },
] as const

function Harness() {
  const [v, setV] = useState<string>('a')
  return <Segmented options={options} value={v} onChange={setV} aria-label="Группа" />
}

describe('Segmented', () => {
  it('only the checked option is in the tab order', () => {
    render(<Harness />)
    expect(screen.getByRole('radio', { name: 'Один' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Три' })).toHaveAttribute('tabindex', '-1')
  })

  it('arrows move the choice and the focus, skipping disabled options', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('radio', { name: 'Один' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Три' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Три' })).toBeChecked()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Один' })).toBeChecked()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Три' })).toBeChecked()
  })
})
