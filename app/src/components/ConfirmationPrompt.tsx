import type { SignResult, SignStatus } from '../hooks/useTransactionSigner'

export type ConfirmationStatus = 'pending' | 'confirmed' | 'cancelled'

export interface ConfirmationData {
  id: string
  action: string
  amount?: string
  fee?: string
  recipient?: string
  serializedTx?: string
  status: ConfirmationStatus
  signature?: string
  txError?: string
  signStatus?: SignStatus
}

interface ConfirmationPromptProps {
  data: ConfirmationData
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onSign?: (id: string, serializedTx: string) => Promise<SignResult>
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function truncateSignature(sig: string): string {
  if (sig.length <= 16) return sig
  return `${sig.slice(0, 8)}...${sig.slice(-4)}`
}

function explorerUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`
}

export default function ConfirmationPrompt({ data, onConfirm, onCancel, onSign }: ConfirmationPromptProps) {
  const isPending = data.status === 'pending'
  const isSigning = data.signStatus === 'signing' || data.signStatus === 'broadcasting'

  const handleConfirm = () => {
    if (data.serializedTx && onSign) {
      onSign(data.id, data.serializedTx)
    } else {
      onConfirm(data.id)
    }
  }

  const statusIcon = isPending
    ? '\u26a0'
    : data.status === 'confirmed'
      ? '\u2713'
      : '\u2715'

  return (
    <div className="confirmation">
      <div className="confirmation__card">
        <div className="confirmation__header">
          {statusIcon}{' '}{data.action}
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
              onClick={handleConfirm}
              disabled={isSigning}
            >
              {data.signStatus === 'signing'
                ? 'Signing...'
                : data.signStatus === 'broadcasting'
                  ? 'Broadcasting...'
                  : 'Confirm & Sign'}
            </button>
            <button
              className="confirmation__btn confirmation__btn--cancel"
              onClick={() => onCancel(data.id)}
              disabled={isSigning}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="confirmation__footer">
            {data.status === 'confirmed' && data.signature ? (
              <div className="confirmation__status confirmation__status--confirmed">
                {'\u2713'} Confirmed:{' '}
                <a
                  href={explorerUrl(data.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="confirmation__sig-link"
                >
                  {truncateSignature(data.signature)}
                </a>
              </div>
            ) : data.status === 'confirmed' ? (
              <div className="confirmation__status confirmation__status--confirmed">
                Transaction signed
              </div>
            ) : data.txError ? (
              <div className="confirmation__status confirmation__status--error">
                {data.txError}
              </div>
            ) : (
              <div className="confirmation__status confirmation__status--cancelled">
                Cancelled
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
