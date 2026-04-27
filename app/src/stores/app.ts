import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat'
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
  activeView: View
  setActiveView: (view: View) => void

  token: string | null
  isAdmin: boolean
  setAuth: (token: string, isAdmin: boolean) => void
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
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'sipher-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, isAdmin: s.isAdmin }),
    }
  )
)
