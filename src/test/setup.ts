import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Tests read the Russian strings; the English dictionary has tests of its own.
vi.mock('../i18n/lang', () => ({ lang: 'ru', locale: 'ru', setLang: vi.fn() }))

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})
