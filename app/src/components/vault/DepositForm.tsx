import { useState } from 'react'
import AmountForm from '../AmountForm'
import { AssetSelector } from './AssetSelector'
import { TxStatusBadge } from './TxStatusBadge'
import type { SignStatus } from '../../hooks/useTransactionSigner'

interface DepositFormProps {
  onSubmit: (amount: number, asset: string) => Promise<void>
  maxByAsset: Record<string, number>
  disabled: boolean
  status: SignStatus
  signature?: string
}

const ASSETS = ['SOL', 'USDC', 'USDT'] as const

export function DepositForm({
  onSubmit,
  maxByAsset,
  disabled,
  status,
  signature,
}: DepositFormProps) {
  const [asset, setAsset] = useState<string>('SOL')
  const max = maxByAsset[asset] ?? 0

  const handleSubmit = (amount: number) => {
    if (disabled) return
    void onSubmit(amount, asset)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          ASSET
        </span>
        <AssetSelector assets={ASSETS} value={asset} onChange={setAsset} />
      </div>
      <AmountForm
        action="Deposit"
        max={max}
        onSubmit={handleSubmit}
        onCancel={() => {}}
        assetSymbol={asset}
      />
      <TxStatusBadge status={status} signature={signature} />
    </div>
  )
}
