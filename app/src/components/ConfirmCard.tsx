import { Warning } from '@phosphor-icons/react'

type Variant = 'normal' | 'warning'

interface Props {
  action: string
  amount: string
  onConfirm: () => void
  onCancel: () => void
  variant?: Variant
  description?: string
  // disables both buttons (e.g. while a parent dispatches a REST call)
  disabled?: boolean
  // reserved for future countdown display; not currently consumed
  timeout?: number
}

export default function ConfirmCard({
  action,
  amount,
  onConfirm,
  onCancel,
  variant = 'normal',
  description,
  disabled = false,
}: Props) {
  const isWarning = variant === 'warning'
  const borderClass = isWarning ? 'border-yellow/40' : 'border-elevated'
  const primaryClass = isWarning
    ? 'border-yellow/50 text-yellow hover:bg-yellow/10'
    : 'border-sipher/50 text-sipher hover:bg-sipher/10'
  const primaryLabel = isWarning ? 'Override & Send' : 'Confirm & Sign'
  const labelText = isWarning ? 'Risk Confirm' : 'Confirm Action'

  return (
    <div className={`bg-card border ${borderClass} rounded-lg p-4 flex flex-col gap-3`}>
      <div className="text-[12px] text-text-muted uppercase tracking-wide flex items-center gap-1">
        {isWarning && <Warning size={12} weight="fill" className="text-yellow" aria-hidden="true" />}
        <span>{labelText}</span>
      </div>
      <div className="text-[14px] text-text">{action}: {amount}</div>
      {description && (
        <div className="text-[12px] text-text-muted leading-relaxed">{description}</div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={disabled}
          className={`flex-1 border ${primaryClass} py-2 rounded-lg text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {primaryLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className="px-4 border border-elevated text-text-muted py-2 rounded-lg text-[12px] hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
