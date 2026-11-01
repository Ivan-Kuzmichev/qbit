import { create } from 'zustand'

export type LimitsTab = 'torrent' | 'global' | 'alt'
export type AddTab = 'file' | 'magnet'

export type OpenDialog =
  | { kind: 'delete'; hashes: string[] }
  | { kind: 'move'; hashes: string[] }
  | { kind: 'limits'; tab: LimitsTab; hashes: string[] }
  | { kind: 'add'; tab: AddTab; files: File[] }

interface DialogsState {
  open: OpenDialog | null
  /** Bumped on every open call, so the host can remount a dialog that is opened again while showing. */
  seq: number
  openDelete(hashes: string[]): void
  openMove(hashes: string[]): void
  openLimits(tab: LimitsTab, hashes?: string[]): void
  openAdd(tab: AddTab, files?: File[]): void
  close(): void
}

export const useDialogs = create<DialogsState>()((set) => ({
  open: null,
  seq: 0,
  openDelete: (hashes) => set((s) => ({ open: { kind: 'delete', hashes }, seq: s.seq + 1 })),
  openMove: (hashes) => set((s) => ({ open: { kind: 'move', hashes }, seq: s.seq + 1 })),
  openLimits: (tab, hashes = []) => set((s) => ({ open: { kind: 'limits', tab, hashes }, seq: s.seq + 1 })),
  openAdd: (tab, files = []) => set((s) => ({ open: { kind: 'add', tab, files }, seq: s.seq + 1 })),
  close: () => set({ open: null }),
}))
