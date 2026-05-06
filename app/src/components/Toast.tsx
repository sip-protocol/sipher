import { X } from '@phosphor-icons/react'

export interface ToastInput {
  message: string
  kind?: 'info' | 'warn' | 'error' | 'success'
  durationMs?: number
  action?: { label: string; onClick: () => void }
}

const kindStyles: Record<NonNullable<ToastInput['kind']>, string> = {
  info: 'bg-elevated border-border text-text',
  warn: 'bg-amber-950/90 border-amber-700 text-amber-100',
  error: 'bg-red-950/90 border-red-700 text-red-100',
  success: 'bg-emerald-950/90 border-emerald-700 text-emerald-100',
}

export function Toast({ toast, onDismiss }: { toast: ToastInput; onDismiss: () => void }) {
  const styles = kindStyles[toast.kind ?? 'info']
  return (
    <div
      className={`border rounded px-3 py-2 text-sm shadow-lg ${styles}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="opacity-70 hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            onDismiss()
          }}
          className="mt-2 px-2 py-1 bg-text/10 hover:bg-text/20 rounded text-xs"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
