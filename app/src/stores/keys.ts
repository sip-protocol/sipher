import { create } from 'zustand'

interface KeyState {
  hash: string | null
  set: (hash: string) => void
  clear: () => void
}

export const useKeyStore = create<KeyState>((set) => ({
  hash: null,
  set: (hash) => set({ hash }),
  clear: () => set({ hash: null }),
}))
