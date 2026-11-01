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

  const three = [
    { id: 'a', label: 'Один', onSelect: vi.fn() },
    { id: 'b', label: 'Два', onSelect: vi.fn() },
    { id: 'c', label: 'Три', onSelect: vi.fn() },
  ]

  it('Home and End jump to the first and last item', async () => {
    const user = userEvent.setup()
    render(<Menu items={three} label="Меню">x</Menu>)
    await user.click(screen.getByRole('button', { name: 'Меню' }))
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Три' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Один' })).toHaveFocus()
  })

  it('Tab closes the menu and moves on from the trigger', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Menu items={three} label="Меню">x</Menu>
        <button>после</button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Меню' }))
    await user.keyboard('{Tab}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'после' })).toHaveFocus()
  })

  it('selecting an item returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Menu items={three} label="Меню" portal>x</Menu>)
    await user.click(screen.getByRole('button', { name: 'Меню' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(three[1].onSelect).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Меню' })).toHaveFocus()
  })

  it('Escape closes only the menu: it does not reach listeners further up', async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    render(<Menu items={three} label="Меню">x</Menu>)
    await user.click(screen.getByRole('button', { name: 'Меню' }))
    await user.keyboard('{Escape}')
    document.removeEventListener('keydown', outer)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
  })

  it('popup menus rise above dialogs and sheets', async () => {
    render(<Menu items={three} label="Меню" portal>x</Menu>)
    await userEvent.click(screen.getByRole('button', { name: 'Меню' }))
    expect(screen.getByRole('menu').className).toMatch(/portal/)
  })
})
