import { useRef, useEffect, useState, useCallback } from 'react'
import { PaperPlaneTilt, CircleNotch, Wrench } from '@phosphor-icons/react'
import { useAppStore, type ChatMessage } from '../stores/app'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../providers/ToastProvider'
import { sanitizeArgs } from '../lib/sanitize-args'
import { isAuthError } from '../lib/auth-errors'
import { triggerAuthInterceptor } from '../api/client'
import ToolTimeline from './ToolTimeline'
import SentinelConfirm from './SentinelConfirm'

const API_URL = import.meta.env.VITE_API_URL ?? ''

// Wave 2b #218 — educational prompts shown in the unauthed empty state.
// RECTOR may polish copy at PR review; chips are click-to-send.
const SUGGESTED_QUESTIONS: ReadonlyArray<string> = [
  'How does a stealth address work?',
  "What's the difference between SIPHER and Tornado Cash?",
  'Why are viewing keys important for compliance?',
]

const UNAUTHED_FREE_CAP = 5

interface Props {
  fullScreen?: boolean
}

export default function ChatSidebar({ fullScreen }: Props) {
  const { token } = useAuthState()
  const { show: showToast } = useToast()
  const messages = useAppStore((s) => s.messages)
  const chatLoading = useAppStore((s) => s.chatLoading)
  const addMessage = useAppStore((s) => s.addMessage)
  const appendToLast = useAppStore((s) => s.appendToLast)
  const finishStreaming = useAppStore((s) => s.finishStreaming)
  const setChatLoading = useAppStore((s) => s.setChatLoading)
  const appendTool = useAppStore((s) => s.appendTool)
  const completeTool = useAppStore((s) => s.completeTool)
  const dismissMessage = useAppStore((s) => s.dismissMessage)
  const consumePendingPrompt = useAppStore((s) => s.consumePendingPrompt)
  const unauthedRemaining = useAppStore((s) => s.unauthedRemaining)
  const setUnauthedRemaining = useAppStore((s) => s.setUnauthedRemaining)

  const mode: 'authed' | 'unauthed' = token ? 'authed' : 'unauthed'

  const [input, setInput] = useState('')
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  // Effective remaining count: null → CAP (no message sent yet this session),
  // otherwise the clamped number from the last X-RateLimit-Remaining header.
  const effectiveRemaining = unauthedRemaining ?? UNAUTHED_FREE_CAP
  const unauthedBudgetExhausted = mode === 'unauthed' && effectiveRemaining <= 0

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || chatLoading) return
    if (mode === 'authed' && !token) return
    if (mode === 'unauthed' && unauthedBudgetExhausted) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    addMessage(userMsg)
    setInput('')
    setChatLoading(true)
    setActiveTool(null)

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    addMessage(assistantMsg)

    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const url = mode === 'authed'
        ? `${API_URL}/api/chat/stream`
        : `${API_URL}/api/public/chat/stream`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (mode === 'authed' && token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: allMessages }),
      })

      // In unauthed mode, every response (200 or 429) emits X-RateLimit-Remaining.
      // Sync it before branching on res.ok so the banner stays truthful even
      // on rate-limit errors.
      if (mode === 'unauthed') {
        const remainingHeader = res.headers.get('X-RateLimit-Remaining')
        if (remainingHeader !== null) {
          const parsed = Number.parseInt(remainingHeader, 10)
          if (Number.isFinite(parsed)) setUnauthedRemaining(Math.max(0, parsed))
        }
      }

      if (!res.ok) {
        if (mode === 'authed' && res.status === 401) {
          // Drop the empty assistant placeholder so the user doesn't see a
          // ghost bubble next to the session-expired toast. The toast (wired
          // globally in AuthSyncProvider) carries the re-auth UX.
          dismissMessage(assistantMsg.id)
          triggerAuthInterceptor()
          return
        }

        if (mode === 'unauthed' && res.status === 429) {
          // 429 envelope from /api/public/chat/stream:
          //   { error: { code, message, resetAt } }
          dismissMessage(assistantMsg.id)
          const body = (await res.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string; resetAt?: number }
          }
          const resetAt = body.error?.resetAt
          const resetClock = typeof resetAt === 'number'
            ? new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'tomorrow'
          showToast({
            kind: 'error',
            message: `Daily free limit reached. Resets at ${resetClock}.`,
            durationMs: 6000,
          })
          setUnauthedRemaining(0)
          return
        }

        const err = await res.json().catch(() => ({}))
        const errMessage =
          (err as { error?: { message?: string } | string }).error &&
          typeof (err as { error?: { message?: string } | string }).error === 'object'
            ? ((err as { error: { message?: string } }).error.message ?? `Error ${res.status}`)
            : (((err as { error?: string }).error as string | undefined) ?? `Error ${res.status}`)
        throw new Error(errMessage)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break

          try {
            const event = JSON.parse(data)
            if (event.type === 'content_block_delta' && event.text) {
              appendToLast(event.text)
            } else if (event.type === 'tool_use') {
              appendTool(event.name, sanitizeArgs(event.input))
              setActiveTool(event.name)
            } else if (event.type === 'tool_result') {
              completeTool(event.name, event.is_error ? 'error' : 'success')
              setActiveTool(null)
            } else if (event.type === 'sentinel_pause') {
              addMessage({
                id: crypto.randomUUID(),
                role: 'system',
                content: '',
                kind: 'sentinel_pause' as const,
                meta: {
                  flagId: event.flagId,
                  action: event.action,
                  amount: event.amount,
                  description: event.description,
                  severity: event.severity,
                },
              })
            } else if (event.type === 'error') {
              appendToLast(`\n\nError: ${event.message}`)
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      // 401-class errors flow through the global apiFetch interceptor's
      // session-expired toast; suppress here so we don't double-notify or
      // paint the raw token-error text into the assistant's bubble.
      if (!isAuthError(msg)) {
        showToast({ message: msg, kind: 'error', durationMs: 6000 })
      }
    } finally {
      finishStreaming()
      setChatLoading(false)
      setActiveTool(null)
    }
  }, [
    input,
    mode,
    token,
    chatLoading,
    unauthedBudgetExhausted,
    messages,
    addMessage,
    appendToLast,
    finishStreaming,
    setChatLoading,
    appendTool,
    completeTool,
    dismissMessage,
    showToast,
    setUnauthedRemaining,
  ])

  // Consume seedChat prompt on mount/change (authed only — unauthed mode
  // never receives a pending prompt because deep-link CTAs require auth).
  useEffect(() => {
    const p = consumePendingPrompt()
    if (p && token) sendMessage(p)
  }, [consumePendingPrompt, sendMessage, token])

  // ─── Compute view-state flags shared by render branches ────────────────────
  const isAuthed = mode === 'authed'
  const sendDisabled =
    chatLoading ||
    (isAuthed ? !input.trim() || !token : unauthedBudgetExhausted || !input.trim())
  const inputDisabled =
    chatLoading || (isAuthed ? !token : unauthedBudgetExhausted)
  const placeholder = isAuthed
    ? token
      ? 'Message SIPHER...'
      : 'Connect wallet first'
    : unauthedBudgetExhausted
      ? 'Connect wallet to continue'
      : 'Ask SIPHER about privacy...'

  return (
    <div className={`flex flex-col bg-card ${fullScreen ? 'h-full' : 'h-full w-full'}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-sipher" />
        <span className="text-[13px] font-semibold text-text">SIPHER</span>
        {chatLoading && activeTool && (
          <span className="text-[11px] text-text-muted flex items-center gap-1">
            <Wrench size={11} className="animate-spin" />
            {activeTool}
          </span>
        )}
        {chatLoading && !activeTool && (
          <CircleNotch size={12} className="text-text-muted animate-spin" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {messages.length === 0 && isAuthed && (
          <p className="text-text-muted text-sm text-center py-8">
            Ask SIPHER anything about your privacy.
          </p>
        )}
        {messages.length === 0 && !isAuthed && (
          <div className="py-6 flex flex-col gap-3">
            <p className="text-text-muted text-sm text-center">
              Ask SIPHER about privacy on Solana
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={chatLoading || unauthedBudgetExhausted}
                  className="text-left bg-elevated border border-border rounded-lg px-3 py-2 text-[12px] text-text hover:border-accent/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.filter((m) => !m.dismissed).map((msg) => {
          if (msg.role === 'system' && msg.kind === 'sentinel_pause' && token) {
            const meta = (msg.meta ?? {}) as { flagId?: string; action?: string; amount?: string; description?: string }
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[90%] w-full">
                  <SentinelConfirm
                    flagId={meta.flagId ?? ''}
                    action={meta.action ?? 'Action'}
                    amount={meta.amount ?? ''}
                    description={meta.description}
                    onResolved={() => dismissMessage(msg.id)}
                  />
                </div>
              </div>
            )
          }
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg overflow-hidden text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-accent/15 border border-accent/20 text-text px-3 py-2'
                    : 'bg-elevated border border-border text-text'
                }`}
              >
                {msg.role === 'assistant' && <ToolTimeline tools={msg.tools} />}
                <div className={msg.role === 'assistant' ? 'px-3 py-2' : ''}>
                  {msg.content || (msg.streaming ? '...' : '')}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-3 border-t border-border shrink-0">
        {!isAuthed && (
          <div className="mb-2 text-[11px] text-text-muted text-center">
            {effectiveRemaining > 0
              ? `${effectiveRemaining} of ${UNAUTHED_FREE_CAP} free messages — connect wallet for unlimited`
              : 'Connect wallet to continue'}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            aria-label="Ask SIPHER"
            maxLength={4000}
            placeholder={placeholder}
            className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            disabled={inputDisabled}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sendDisabled}
            className="bg-accent/15 border border-accent/20 rounded-lg px-3 py-2 text-accent hover:bg-accent/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Send"
          >
            <PaperPlaneTilt size={16} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  )
}
