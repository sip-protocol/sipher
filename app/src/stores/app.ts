import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { onAuthClear } from '../store/onAuthClear'

export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat' | 'privacyReport' | 'chains' | 'deposit' | 'withdraw' | 'keys' | 'settings' | 'about'
export type ToolStatus = 'running' | 'success' | 'error'

export interface ToolCall {
  name: string
  args?: string
  startedAt: number
  durationMs?: number
  status: ToolStatus
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolName?: string
  streaming?: boolean
  tools?: ToolCall[]
  kind?: 'sentinel_pause'
  meta?: Record<string, unknown>
  dismissed?: boolean
}

interface AppState {
  token: string | null
  isAdmin: boolean
  expiresAt: number | null
  setAuth: (token: string, isAdmin: boolean, expiresAt?: number | null) => void
  clearAuth: () => void

  messages: ChatMessage[]
  chatLoading: boolean
  addMessage: (msg: ChatMessage) => void
  appendToLast: (text: string) => void
  finishStreaming: () => void
  setChatLoading: (loading: boolean) => void
  appendTool: (name: string, args?: string) => void
  completeTool: (name: string, status: ToolStatus) => void
  dismissMessage: (id: string) => void
  seedChat: (prompt: string) => void

  chatOpen: boolean
  setChatOpen: (open: boolean) => void
  pendingPrompt: string | null
  consumePendingPrompt: () => string | null

  chatSheetOpen: boolean
  setChatSheetOpen: (open: boolean) => void

  // Wave 2b #218 — unauthed chat budget. Null = unknown (no message sent yet
  // in this session). Number = X-RateLimit-Remaining from the last public
  // chat response. Reset to null on auth state changes so authed→unauthed
  // transitions start fresh.
  unauthedRemaining: number | null
  setUnauthedRemaining: (n: number | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      token: null,
      isAdmin: false,
      expiresAt: null,
      setAuth: (token, isAdmin, expiresAt = null) =>
        set({ token, isAdmin, expiresAt, unauthedRemaining: null }),
      clearAuth: () => {
        set({
          token: null,
          isAdmin: false,
          expiresAt: null,
          messages: [],
          unauthedRemaining: null,
        })
        onAuthClear.clearAll()
      },

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
      appendTool: (name, args) =>
        set((s) => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role !== 'assistant') return { messages: msgs }
          const tools = [...(last.tools ?? []), { name, args, startedAt: Date.now(), status: 'running' as ToolStatus }]
          msgs[msgs.length - 1] = { ...last, tools }
          return { messages: msgs }
        }),
      completeTool: (name, status) =>
        set((s) => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role !== 'assistant' || !last.tools) return { messages: msgs }
          const tools = last.tools.map((t) =>
            t.name === name && t.status === 'running'
              ? { ...t, durationMs: Date.now() - t.startedAt, status }
              : t
          )
          msgs[msgs.length - 1] = { ...last, tools }
          return { messages: msgs }
        }),
      dismissMessage: (id) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, dismissed: true } : m)),
        })),
      seedChat: (prompt) => set({ chatOpen: true, pendingPrompt: prompt }),

      chatOpen: false,
      setChatOpen: (chatOpen) => set({ chatOpen }),
      pendingPrompt: null,
      consumePendingPrompt: () => {
        const p = get().pendingPrompt
        set({ pendingPrompt: null })
        return p
      },

      chatSheetOpen: false,
      setChatSheetOpen: (chatSheetOpen) => set({ chatSheetOpen }),

      unauthedRemaining: null,
      setUnauthedRemaining: (unauthedRemaining) => set({ unauthedRemaining }),
    }),
    {
      name: 'sipher-auth',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, isAdmin: s.isAdmin, expiresAt: s.expiresAt }),
      migrate: (persistedState, fromVersion) => {
        if (fromVersion === 0) {
          return { ...(persistedState as object), token: null, isAdmin: false, expiresAt: null }
        }
        return persistedState as Partial<AppState>
      },
    }
  )
)
