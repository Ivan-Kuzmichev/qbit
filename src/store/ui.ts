import { create } from 'zustand'

const ACCENT_KEY = 'qbit.accent'
const DEFAULT_ACCENT = '#60A5FA'

export type SortDir = 'asc' | 'desc'

function loadAccent(): string {
  try {
    return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

function applyAccent(c: string): void {
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--accent', c)
}

interface UiState {
  accent: string
  setAccent(c: string): void
  filter: string
  setFilter(f: string): void
  search: string
  setSearch(s: string): void
  sort: { key: string; dir: SortDir }
  setSort(sort: { key: string; dir: SortDir }): void
}

const initialAccent = loadAccent()
applyAccent(initialAccent)

export const useUi = create<UiState>()((set) => ({
  accent: initialAccent,
  setAccent(c) {
    try {
      localStorage.setItem(ACCENT_KEY, c)
    } catch {
      // storage unavailable: keep the choice for this session only
    }
    applyAccent(c)
    set({ accent: c })
  },
  filter: 'all',
  setFilter: (filter) => set({ filter }),
  search: '',
  setSearch: (search) => set({ search }),
  sort: { key: 'added_on', dir: 'desc' },
  setSort: (sort) => set({ sort }),
}))
