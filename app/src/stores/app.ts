import { create } from 'zustand'

export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolName?: string
  streaming?: boolean
}

interface AppState {
  // Navigation
  activeView: View
  setActiveView: (view: View) => void

  // Auth
  token: string | null
  isAdmin: boolean
  setAuth: (token: string, isAdmin: boolean) => void
  clearAuth: () => void

  // Chat
  messages: ChatMessage[]
  chatLoading: boolean
  addMessage: (msg: ChatMessage) => void
  appendToLast: (text: string) => void
  finishStreaming: () => void
  setChatLoading: (loading: boolean) => void

  // UI (tablet/mobile chat visibility)
  chatOpen: boolean
  setChatOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (activeView) => set({ activeView }),

  token: null,
  isAdmin: false,
  setAuth: (token, isAdmin) => set({ token, isAdmin }),
  clearAuth: () => set({ token: null, isAdmin: false, messages: [], activeView: 'dashboard' }),

  messages: [],
  chatLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToLast: (text) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + text }
      }
      return { messages: msgs }
    }),
  finishStreaming: () =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last?.streaming) {
        msgs[msgs.length - 1] = { ...last, streaming: false }
      }
      return { messages: msgs }
    }),
  setChatLoading: (chatLoading) => set({ chatLoading }),

  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
}))
