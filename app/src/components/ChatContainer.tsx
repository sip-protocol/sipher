import { useState, useRef, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import TextMessage from './TextMessage'
import ConfirmationPrompt, { type ConfirmationData, type ConfirmationStatus } from './ConfirmationPrompt'
import QuickActions from './QuickActions'
import { useTransactionSigner, type SignStatus } from '../hooks/useTransactionSigner'

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  error?: boolean
}

interface ConfirmationMessage {
  id: string
  type: 'confirmation'
  data: ConfirmationData
  timestamp: Date
}

type Message = ChatMessage | ConfirmationMessage

function isConfirmation(msg: Message): msg is ConfirmationMessage {
  return 'type' in msg && msg.type === 'confirmation'
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const API_URL = '/api/chat'
const STREAM_URL = '/api/chat/stream'

export default function ChatContainer() {
  const { connected, publicKey } = useWallet()
  const { signAndBroadcast } = useTransactionSigner()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const updateConfirmation = useCallback((confirmId: string, patch: Partial<ConfirmationData>) => {
    setMessages(prev =>
      prev.map(msg => {
        if (isConfirmation(msg) && msg.data.id === confirmId) {
          return { ...msg, data: { ...msg.data, ...patch } }
        }
        return msg
      })
    )
  }, [])

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages(prev =>
      prev.map(msg => {
        if (!isConfirmation(msg) && msg.id === id) {
          return { ...msg, ...patch }
        }
        return msg
      })
    )
  }, [])

  /**
   * Try SSE streaming first — real-time token delivery.
   * Returns true if streaming succeeded, false if it should fall back to POST.
   */
  const tryStreamingChat = useCallback(async (
    chatHistory: { role: 'user' | 'assistant'; content: string }[],
    placeholderId: string,
  ): Promise<boolean> => {
    let res: Response
    try {
      res = await fetch(STREAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          wallet: publicKey?.toBase58() ?? null,
        }),
      })
    } catch {
      return false // Network error — fall back to POST
    }

    if (!res.ok || !res.body) return false

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)

          if (payload === '[DONE]') break

          try {
            const event = JSON.parse(payload)

            if (event.type === 'content_block_delta' && event.text) {
              accumulated += event.text
              updateMessage(placeholderId, { content: accumulated })
            } else if (event.type === 'message_complete') {
              // Final content — ensure full text is set
              if (event.content) {
                updateMessage(placeholderId, { content: event.content })
              }
            } else if (event.type === 'error') {
              updateMessage(placeholderId, {
                content: event.message ?? 'Stream error occurred.',
                error: true,
              })
              return true // Error delivered via stream — don't fall back
            }
          } catch {
            // Malformed JSON line — skip it
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return true
  }, [publicKey, updateMessage])

  /**
   * Fallback: POST to /api/chat and wait for full response.
   */
  const postChat = useCallback(async (
    chatHistory: { role: 'user' | 'assistant'; content: string }[],
    placeholderId: string,
  ): Promise<void> => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chatHistory,
        wallet: publicKey?.toBase58() ?? null,
      }),
    })

    if (!res.ok) {
      throw new Error(`Agent responded with ${res.status}`)
    }

    const data = await res.json()
    const agentText = data.content ?? data.message ?? 'No response from agent.'

    updateMessage(placeholderId, { content: agentText })

    // If the response includes a confirmation request, render it
    if (data.confirmation) {
      const confirmId = generateId()
      addMessage({
        id: generateId(),
        type: 'confirmation',
        data: {
          id: confirmId,
          action: data.confirmation.action ?? 'Transaction',
          amount: data.confirmation.amount,
          fee: data.confirmation.fee,
          recipient: data.confirmation.recipient,
          serializedTx: data.confirmation.serializedTx,
          status: 'pending',
        },
        timestamp: new Date(),
      })
    }
  }, [publicKey, addMessage, updateMessage])

  const sendToAgent = useCallback(async (userText: string) => {
    const chatHistory = messages
      .filter((m): m is ChatMessage => !isConfirmation(m))
      .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }))

    chatHistory.push({ role: 'user', content: userText })

    // Create a placeholder message for real-time streaming updates
    const placeholderId = generateId()
    addMessage({
      id: placeholderId,
      role: 'agent',
      content: '',
      timestamp: new Date(),
    })

    setLoading(true)

    try {
      // Try streaming first, fall back to POST on failure
      const streamed = await tryStreamingChat(chatHistory, placeholderId)
      if (!streamed) {
        await postChat(chatHistory, placeholderId)
      }
    } catch {
      updateMessage(placeholderId, {
        content: 'Sipher agent is offline. Make sure the server is running on /api/chat.',
        error: true,
      })
    } finally {
      setLoading(false)
    }
  }, [messages, publicKey, addMessage, updateMessage, tryStreamingChat, postChat])

  const handleSend = useCallback((text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    addMessage({
      id: generateId(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    })

    if (!text) setInput('')

    sendToAgent(msg)
  }, [input, loading, addMessage, sendToAgent])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickAction = (message: string) => {
    handleSend(message)
  }

  const handleConfirm = (id: string) => {
    updateConfirmation(id, { status: 'confirmed' as ConfirmationStatus })
    addMessage({
      id: generateId(),
      role: 'agent',
      content: 'Transaction confirmed (no on-chain transaction for this action).',
      timestamp: new Date(),
    })
  }

  const handleSign = useCallback(async (confirmId: string, serializedTx: string) => {
    updateConfirmation(confirmId, { signStatus: 'signing' as SignStatus })

    const result = await signAndBroadcast(serializedTx)

    if (result.signature) {
      updateConfirmation(confirmId, {
        status: 'confirmed',
        signStatus: 'confirmed',
        signature: result.signature,
      })
      addMessage({
        id: generateId(),
        role: 'agent',
        content: `Transaction confirmed: ${result.signature}`,
        timestamp: new Date(),
      })
    } else {
      updateConfirmation(confirmId, {
        signStatus: 'error',
        txError: result.error ?? 'Transaction failed',
      })
      addMessage({
        id: generateId(),
        role: 'agent',
        content: `Transaction failed: ${result.error}`,
        timestamp: new Date(),
        error: true,
      })
    }

    return result
  }, [signAndBroadcast, updateConfirmation, addMessage])

  const handleCancel = (id: string) => {
    updateConfirmation(id, { status: 'cancelled' as ConfirmationStatus })
    addMessage({
      id: generateId(),
      role: 'agent',
      content: 'Transaction cancelled.',
      timestamp: new Date(),
    })
  }

  const isEmpty = messages.length === 0

  return (
    <div className="chat-container">
      <div className={`chat-messages${isEmpty ? ' chat-messages--empty' : ''}`}>
        {isEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty__icon">{'\u{1f510}'}</div>
            <div className="chat-empty__title">Sipher Privacy Agent</div>
            <div className="chat-empty__subtitle">
              {connected
                ? 'Ask me anything about private transfers, vault operations, or stealth payments.'
                : 'Connect your wallet to get started.'}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg =>
              isConfirmation(msg) ? (
                <ConfirmationPrompt
                  key={msg.id}
                  data={msg.data}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  onSign={handleSign}
                />
              ) : (
                <TextMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  error={msg.error}
                />
              )
            )}
            {loading && (
              <div className="typing-indicator">
                <div className="typing-indicator__dot" />
                <div className="typing-indicator__dot" />
                <div className="typing-indicator__dot" />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <QuickActions onAction={handleQuickAction} disabled={loading || !connected} />

      <div className="chat-input-bar">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? 'Message Sipher agent...' : 'Connect wallet to chat'}
          disabled={!connected || loading}
          rows={1}
        />
        <button
          className="chat-input-bar__send"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading || !connected}
          aria-label="Send message"
        >
          {'\u2191'}
        </button>
      </div>
    </div>
  )
}
