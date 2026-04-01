export type ConfirmationStatus = 'pending' | 'confirmed' | 'cancelled'

export interface ConfirmationData {
  id: string
  action: string
  amount?: string
  fee?: string
  recipient?: string
  status: ConfirmationStatus
}

interface ConfirmationPromptProps {
  data: ConfirmationData
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function ConfirmationPrompt({ data, onConfirm, onCancel }: ConfirmationPromptProps) {
  const isPending = data.status === 'pending'

  return (
    <div className="confirmation">
      <div className="confirmation__card">
        <div className="confirmation__header">
          {isPending ? '\u26a0' : data.status === 'confirmed' ? '\u2713' : '\u2715'}
          {' '}{data.action}
        </div>

        <div className="confirmation__body">
          {data.amount && (
            <div className="confirmation__row">
              <span className="confirmation__label">Amount</span>
              <span className="confirmation__value confirmation__value--amount">{data.amount}</span>
            </div>
          )}
          {data.fee && (
            <div className="confirmation__row">
              <span className="confirmation__label">Fee</span>
              <span className="confirmation__value confirmation__value--fee">{data.fee}</span>
            </div>
          )}
          {data.recipient && (
            <div className="confirmation__row">
              <span className="confirmation__label">Recipient</span>
              <span className="confirmation__value confirmation__value--address">
                {truncateAddress(data.recipient)}
              </span>
            </div>
          )}
        </div>

        {isPending ? (
          <div className="confirmation__actions">
            <button
              className="confirmation__btn confirmation__btn--confirm"
              onClick={() => onConfirm(data.id)}
            >
              Confirm & Sign
            </button>
            <button
              className="confirmation__btn confirmation__btn--cancel"
              onClick={() => onCancel(data.id)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className={`confirmation__status confirmation__status--${data.status}`}>
            {data.status === 'confirmed' ? 'Transaction signed' : 'Cancelled'}
          </div>
        )}
      </div>
    </div>
  )
}
