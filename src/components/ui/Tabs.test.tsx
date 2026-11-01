// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Tabs } from './Tabs'

const tabs = [
  { id: 'a', label: 'Один' },
  { id: 'b', label: 'Два' },
  { id: 'c', label: 'Три' },
] as const

function Harness() {
  const [v, setV] = useState<string>('a')
  return (
    <>
      <Tabs tabs={tabs} value={v} onChange={setV} aria-label="Вкладки" idPrefix="t" />
      <div role="tabpanel" id="t-panel" aria-labelledby={`t-tab-${v}`}>
        {v}
      </div>
    </>
  )
}

describe('Tabs', () => {
  it('only the selected tab is in the tab order', () => {
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Один' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Два' })).toHaveAttribute('tabindex', '-1')
  })

  it('arrows move focus and selection, wrapping around; Home and End jump', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'Один' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Два' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Два' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Три' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Один' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Три' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Один' })).toHaveFocus()
  })

  it('wires tabs to the panel', () => {
    render(<Harness />)
    const tab = screen.getByRole('tab', { name: 'Один' })
    expect(tab).toHaveAttribute('id', 't-tab-a')
    expect(tab).toHaveAttribute('aria-controls', 't-panel')
    expect(screen.getByRole('tabpanel', { name: 'Один' })).toHaveAttribute('id', 't-panel')
  })
})
