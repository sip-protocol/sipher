import { useRef, useEffect, useState, useCallback } from 'react'
import { PaperPlaneTilt, CircleNotch, Wrench } from '@phosphor-icons/react'
import { useAppStore, type ChatMessage } from '../stores/app'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Props {
  fullScreen?: boolean
}

export default function ChatSidebar({ fullScreen }: Props) {
  const token = useAppStore((s) => s.token)
  const messages = useAppStore((s) => s.messages)
  const chatLoading = useAppStore((s) => s.chatLoading)
  const addMessage = useAppStore((s) => s.addMessage)
  const appendToLast = useAppStore((s) => s.appendToLast)
  const finishStreaming = useAppStore((s) => s.finishStreaming)
  const setChatLoading = useAppStore((s) => s.setChatLoading)

  const [input, setInput] = useState('')
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !token || chatLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    }
    addMessage(userMsg)
    setInput('')
    setChatLoading(true)
    setActiveTool(null)

    // Create assistant placeholder
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    addMessage(assistantMsg)

    try {
      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `Error ${res.status}`)
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
              setActiveTool(event.name)
            } else if (event.type === 'tool_result') {
              setActiveTool(null)
            } else if (event.type === 'error') {
              appendToLast(`\n\nError: ${event.message}`)
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      appendToLast(msg || 'Connection failed')
    } finally {
      finishStreaming()
      setChatLoading(false)
      setActiveTool(null)
    }
  }, [input, token, chatLoading, messages, addMessage, appendToLast, finishStreaming, setChatLoading])

  return (
    <div
      className={`flex flex-col bg-card ${
        fullScreen ? 'h-full' : 'h-full w-full'
      }`}
    >
      {/* Header */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {messages.length === 0 && (
          <p className="text-text-muted text-sm text-center py-8">
            Ask SIPHER anything about your privacy.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-accent/15 border border-accent/20 text-text'
                  : 'bg-elevated border border-border text-text'
              }`}
            >
              {msg.content || (msg.streaming ? '...' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border shrink-0">
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
            placeholder={token ? 'Message SIPHER...' : 'Connect wallet first'}
            className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            disabled={!token || chatLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !token || chatLoading}
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
