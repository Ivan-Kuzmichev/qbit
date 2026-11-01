import { create } from 'zustand'
import { ALL_FILTER, type Filter } from '../features/torrents/filters'

const ACCENT_KEY = 'qbit.accent'
const DEFAULT_ACCENT = '#60A5FA'

const COLUMNS_KEY = 'qbit.columns'

export type SortDir = 'asc' | 'desc'
export type OptionalColumn = 'queue' | 'ratio' | 'added'
export type ColumnVisibility = Record<OptionalColumn, boolean>

const DEFAULT_COLUMNS: ColumnVisibility = { queue: false, ratio: false, added: false }

function loadColumns(): ColumnVisibility {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? '{}') as Partial<ColumnVisibility>
    return {
      queue: saved.queue === true,
      ratio: saved.ratio === true,
      added: saved.added === true,
    }
  } catch {
    return DEFAULT_COLUMNS
  }
}

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
  filter: Filter
  setFilter(f: Filter): void
  search: string
  setSearch(s: string): void
  sort: { key: string; dir: SortDir }
  setSort(sort: { key: string; dir: SortDir }): void
  columns: ColumnVisibility
  setColumn(id: OptionalColumn, on: boolean): void
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
  filter: ALL_FILTER,
  setFilter: (filter) => set({ filter }),
  search: '',
  setSearch: (search) => set({ search }),
  sort: { key: 'added_on', dir: 'desc' },
  setSort: (sort) => set({ sort }),
  columns: loadColumns(),
  setColumn(id, on) {
    set((s) => {
      const columns = { ...s.columns, [id]: on }
      try {
        localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns))
      } catch {
        // storage unavailable: keep the choice for this session only
      }
      return { columns }
    })
  },
}))
