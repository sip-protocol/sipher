export default function ConfirmCard({ action, amount, onConfirm, onCancel, timeout = 120 }: {
  action: string
  amount: string
  onConfirm: () => void
  onCancel: () => void
  timeout?: number
}) {
  return (
    <div className="bg-card border border-elevated rounded-lg p-4 flex flex-col gap-3">
      <div className="text-[12px] text-text-muted uppercase tracking-wide">Confirm Action</div>
      <div className="text-[14px] text-text">{action}: {amount}</div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 border border-sipher/50 text-sipher py-2 rounded-lg text-[12px] font-medium hover:bg-sipher/10"
        >
          Confirm & Sign
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
