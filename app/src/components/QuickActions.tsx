interface QuickActionsProps {
  onAction: (message: string) => void
  disabled?: boolean
}

const ACTIONS = [
  { label: 'Balance', message: 'Check my vault balance', icon: '\u{1f4b0}' },
  { label: 'Deposit', message: 'I want to deposit SOL into my vault', icon: '\u{1f4e5}' },
  { label: 'Send', message: 'I want to send a private transfer', icon: '\u{1f4e4}' },
  { label: 'Refund', message: 'I want to refund from my vault', icon: '\u{21a9}' },
  { label: 'Scan', message: 'Scan for incoming stealth payments', icon: '\u{1f50d}' },
] as const

export default function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="quick-actions">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          className="quick-actions__btn"
          onClick={() => onAction(action.message)}
          disabled={disabled}
        >
          {action.icon} {action.label}
        </button>
      ))}
    </div>
  )
}
