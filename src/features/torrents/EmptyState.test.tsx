// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useDialogs } from '../../store/dialogs'
import { useUi } from '../../store/ui'
import { EmptyState } from './EmptyState'

afterEach(() => {
  useDialogs.setState({ open: null })
  useUi.setState({ search: '', filter: { type: 'status', value: 'all' } })
})

describe('EmptyState', () => {
  it('no torrents at all: a message and an Add button that opens the add dialog', async () => {
    render(<EmptyState kind="none" />)
    expect(screen.getByText('Торрентов пока нет')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    expect(useDialogs.getState().open).toMatchObject({ kind: 'add', tab: 'file' })
  })

  it('nothing matches: its own message, and a button that resets search and filter', async () => {
    useUi.setState({ search: 'zzz', filter: { type: 'category', value: 'Софт' } })
    render(<EmptyState kind="noMatch" />)
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.queryByText('Торрентов пока нет')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить поиск и фильтр' }))
    expect(useUi.getState().search).toBe('')
    expect(useUi.getState().filter).toEqual({ type: 'status', value: 'all' })
  })
})
