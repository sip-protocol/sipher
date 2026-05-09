import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RefundList } from '../RefundList'

vi.mock('../../../lib/networkConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/networkConfig')>()
  return {
    ...actual,
    useNetworkConfigStore: <T,>(selector: (s: { config: { solscanSuffix: string } }) => T) =>
      selector({ config: { solscanSuffix: '?cluster=devnet' } }),
  }
})

const fakePosition = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  balance: '2500000000',
  balanceUiAmount: 2.5,
  lockedAmount: '0',
  decimals: 9,
  lastDepositAt: 1715000000,
  refundableAt: 1715086400,
  cooldownActive: false,
  depositRecordAddress: 'DEPOSITRECORDPDA',
}

describe('RefundList', () => {
  it('renders a row per record with mint + balance + Refund button', () => {
    render(
      <RefundList
        records={[fakePosition]}
        onRefund={vi.fn()}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText(/2\.5/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refund/i })).toBeInTheDocument()
  })

  it('disables Refund when cooldownActive', () => {
    render(
      <RefundList
        records={[{ ...fakePosition, cooldownActive: true }]}
        onRefund={vi.fn()}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    expect(screen.getByRole('button', { name: /refund/i })).toBeDisabled()
  })

  it('calls onRefund(token) when Refund clicked', () => {
    const onRefund = vi.fn()
    render(
      <RefundList
        records={[fakePosition]}
        onRefund={onRefund}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /refund/i }))
    expect(onRefund).toHaveBeenCalledWith('SOL')
  })

  it('renders empty-state copy when records is empty', () => {
    render(
      <RefundList
        records={[]}
        onRefund={vi.fn()}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    expect(screen.getByText(/no active vault positions/i)).toBeInTheDocument()
  })

  it('disables Refund and shows Signing badge when statusByToken[symbol] === signing', () => {
    render(
      <RefundList
        records={[fakePosition]}
        onRefund={vi.fn()}
        statusByToken={{ SOL: 'signing' }}
        signaturesByToken={{}}
      />
    )
    expect(screen.getByRole('button', { name: /refund/i })).toBeDisabled()
    expect(screen.getByText(/signing/i)).toBeInTheDocument()
  })
})
