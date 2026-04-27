import { useState } from 'react'

interface Props {
  action: string
  max: number
  onSubmit: (amount: number) => void
  onCancel: () => void
}

export default function AmountForm({ action, max, onSubmit, onCancel }: Props) {
  const [raw, setRaw] = useState('')
  const parsed = Number(raw)
  const valid = raw.length > 0 && Number.isFinite(parsed) && parsed > 0 && parsed <= max

  return (
    <div className="bg-card border border-elevated rounded-lg p-4 flex flex-col gap-3">
      <div className="text-[12px] text-text-muted uppercase tracking-wide">{action} Amount</div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.0001"
          min={0}
          max={max}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-[14px] font-mono text-text focus:outline-none focus:border-accent/40"
          placeholder="0.0"
        />
        <span className="text-[12px] font-mono text-text-muted">SOL</span>
      </div>
      <div className="text-[10px] font-mono text-text-muted">Max: {max} SOL</div>
      <div className="flex gap-2">
        <button
          onClick={() => valid && onSubmit(parsed)}
          disabled={!valid}
          className="flex-1 border border-sipher/50 text-sipher py-2 rounded-lg text-[12px] font-medium hover:bg-sipher/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
        <button
          onClick={onCancel}
          className="px-4 border border-elevated text-text-muted py-2 rounded-lg text-[12px] hover:text-text"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
