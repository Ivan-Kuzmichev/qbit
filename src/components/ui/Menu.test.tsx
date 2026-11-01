// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Menu } from './Menu'

const items = [{ id: 'a', label: 'Один', onSelect: vi.fn() }]

describe('Menu', () => {
  it('stays inside its root by default', async () => {
    const { container } = render(<Menu items={items} label="Меню">x</Menu>)
    await userEvent.click(screen.getByRole('button', { name: 'Меню' }))
    expect(container.contains(screen.getByRole('menu'))).toBe(true)
  })

  it('portal renders the popup under document.body, fixed, and closes on outside scroll', async () => {
    const { container } = render(
      <Menu items={items} label="Меню" portal>
        x
      </Menu>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Меню' }))
    const menu = screen.getByRole('menu')
    expect(container.contains(menu)).toBe(false)
    expect(menu.parentElement).toBe(document.body)
    expect(menu.style.position).toBe('fixed')
    expect(menu.style.top).not.toBe('')
    window.dispatchEvent(new Event('scroll'))
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('portal menu still selects and closes', async () => {
    render(<Menu items={items} label="Меню" portal>x</Menu>)
    await userEvent.click(screen.getByRole('button', { name: 'Меню' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Один' }))
    expect(items[0].onSelect).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
