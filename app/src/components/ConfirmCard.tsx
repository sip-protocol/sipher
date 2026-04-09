export default function ConfirmCard({ action, amount, onConfirm, onCancel, timeout = 120 }: {
  action: string
  amount: string
  onConfirm: () => void
  onCancel: () => void
  timeout?: number
}) {
  return (
    <div className="bg-[#141416] border border-[#1E1E22] rounded-lg p-4 flex flex-col gap-3">
      <div className="text-[12px] text-[#71717A] uppercase tracking-wide">Confirm Action</div>
      <div className="text-[14px] text-[#F5F5F5]">{action}: {amount}</div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 border border-[#10B981]/50 text-[#10B981] py-2 rounded-lg text-[12px] font-medium hover:bg-[#10B981]/10"
        >
          Confirm & Sign
        </button>
        <button
          onClick={onCancel}
          className="px-4 border border-[#1E1E22] text-[#71717A] py-2 rounded-lg text-[12px] hover:text-[#F5F5F5]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
