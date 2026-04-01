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

  const sendToAgent = useCallback(async (userText: string) => {
    // Build conversation history for the API
    const chatHistory = messages
      .filter((m): m is ChatMessage => !isConfirmation(m))
      .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }))

    chatHistory.push({ role: 'user', content: userText })

    setLoading(true)

    try {
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

      addMessage({
        id: generateId(),
        role: 'agent',
        content: agentText,
        timestamp: new Date(),
      })

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
    } catch {
      addMessage({
        id: generateId(),
        role: 'agent',
        content: 'Sipher agent is offline. Make sure the server is running on /api/chat.',
        timestamp: new Date(),
        error: true,
      })
    } finally {
      setLoading(false)
    }
  }, [messages, publicKey, addMessage])

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
