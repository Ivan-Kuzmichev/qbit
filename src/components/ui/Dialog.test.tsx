// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <Dialog
          title="Заголовок"
          onClose={() => {
            onClose?.()
            setOpen(false)
          }}
        >
          <input aria-label="first" />
          <button>last</button>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog', () => {
  it('is a labelled modal dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open'))
    const dlg = screen.getByRole('dialog', { name: 'Заголовок' })
    expect(dlg).toHaveAttribute('aria-modal', 'true')
  })
  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByText('open')
    await user.click(opener)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })
  it('moves focus inside and traps Tab in both directions', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open'))
    const close = screen.getByRole('button', { name: 'Закрыть' })
    const last = screen.getByText('last')
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    last.focus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
  })
  it('closes on backdrop click but not on clicks inside', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByText('open'))
    await user.click(screen.getByLabelText('first'))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('dialog-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('puts the first focus on the first control of the body, not on the close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open'))
    expect(screen.getByLabelText('first')).toHaveFocus()
  })

  it('restores focus to the opener even when the click did not focus it (Safari)', async () => {
    render(<Harness />)
    const opener = screen.getByText('open')
    // Safari does not focus a button on click: only the pointer events happen
    fireEvent.mouseDown(opener)
    fireEvent.click(opener)
    expect(opener).not.toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('Escape handled by something inside (a menu) does not close the dialog', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByText('open'))
    const input = screen.getByLabelText('first')
    input.addEventListener('keydown', (e) => e.preventDefault())
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows an icon and a description, and can go without the close button', () => {
    render(
      <Dialog title="Удалить?" onClose={() => {}} icon={<svg data-testid="icon" />} description="Это нельзя отменить." hideClose>
        <button>Отмена</button>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Удалить?' })
    expect(dialog).toHaveAccessibleDescription('Это нельзя отменить.')
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull()
  })
})
