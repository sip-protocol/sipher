import { useState, useRef, useEffect } from 'react'
import { apiFetch } from '../api/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function CommandBar({ token }: { token: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setExpanded(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, expanded])

  const send = async () => {
    if (!input.trim() || !token) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await apiFetch<{ status: string; message?: string }>('/api/command', {
        method: 'POST',
        body: JSON.stringify({ message: userMsg.content }),
        token,
      })
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: res.message ?? JSON.stringify(res) },
      ])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${message}` }])
    } finally {
      setLoading(false)
    }
  }

  const open = () => {
    setExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  if (!expanded) {
    return (
      <div className="px-4 py-3" onClick={open}>
        <div className="bg-[#141416] border border-[#1E1E22] rounded-lg flex items-center px-3 py-2 cursor-text hover:border-[#2C2C30] transition-colors">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[#71717A] text-[13px]">Talk to SIPHER...</span>
          </div>
          <div className="border border-[#1E1E22] bg-[#0A0A0B] px-1.5 py-[1px] rounded text-[10px] text-[#71717A] font-mono">
            ⌘K
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0B]/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E22]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span className="text-[13px] font-semibold text-[#F5F5F5]">SIPHER</span>
          {loading && (
            <span className="text-[11px] text-[#71717A] animate-pulse">thinking...</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-[#71717A] hover:text-[#F5F5F5] transition-colors"
          aria-label="Close"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-[#71717A] text-sm text-center py-8">
            Ask SIPHER anything about your privacy.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-[#141416] border border-[#1E1E22] text-[#F5F5F5]'
                  : 'bg-[#10B981]/10 border border-[#10B981]/20 text-[#F5F5F5]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#1E1E22]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Type a command..."
            className="flex-1 bg-[#141416] border border-[#1E1E22] rounded-lg px-3 py-2.5 text-[13px] text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#2C2C30]"
            disabled={!token || loading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || !token || loading}
            className="bg-[#141416] border border-[#1E1E22] rounded-lg px-3 py-2.5 text-[#71717A] hover:text-[#F5F5F5] disabled:opacity-30 transition-colors"
            aria-label="Send"
          >
            ↵
          </button>
        </div>
      </div>
    </div>
  )
}
