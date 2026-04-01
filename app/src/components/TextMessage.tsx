import { useMemo } from 'react'

export interface TextMessageProps {
  role: 'user' | 'agent'
  content: string
  timestamp?: Date
  error?: boolean
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Parse minimal markdown: **bold**, `inline code`, and ```code blocks```
 * Returns HTML string for dangerouslySetInnerHTML.
 * Sanitization: we only process our own agent/user text, no external HTML.
 */
function parseMarkdown(text: string): string {
  // Escape HTML entities first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (```...```)
  html = html.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
    return `<pre><code>${code.trim()}</code></pre>`
  })

  // Inline code (`...`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold (**...**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Line breaks
  html = html.replace(/\n/g, '<br />')

  return html
}

export default function TextMessage({ role, content, timestamp, error }: TextMessageProps) {
  const html = useMemo(() => parseMarkdown(content), [content])

  const classNames = [
    'message',
    role === 'user' ? 'message--user' : 'message--agent',
    error ? 'message--error' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <div>
        <div
          className="message__bubble"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {timestamp && (
          <div className="message__timestamp">{formatTime(timestamp)}</div>
        )}
      </div>
    </div>
  )
}
