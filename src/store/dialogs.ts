import { create } from 'zustand'

export type LimitsTab = 'torrent' | 'global'
export type AddTab = 'file' | 'magnet'

export type OpenDialog =
  | { kind: 'delete'; hashes: string[] }
  | { kind: 'move'; hashes: string[] }
  | { kind: 'limits'; tab: LimitsTab; hashes: string[] }
  | { kind: 'add'; tab: AddTab; files: File[] }

interface DialogsState {
  open: OpenDialog | null
  openDelete(hashes: string[]): void
  openMove(hashes: string[]): void
  openLimits(tab: LimitsTab, hashes?: string[]): void
  openAdd(tab: AddTab, files?: File[]): void
  close(): void
}

export const useDialogs = create<DialogsState>()((set) => ({
  open: null,
  openDelete: (hashes) => set({ open: { kind: 'delete', hashes } }),
  openMove: (hashes) => set({ open: { kind: 'move', hashes } }),
  openLimits: (tab, hashes = []) => set({ open: { kind: 'limits', tab, hashes } }),
  openAdd: (tab, files = []) => set({ open: { kind: 'add', tab, files } }),
  close: () => set({ open: null }),
}))
