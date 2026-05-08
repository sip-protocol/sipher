import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StealthAddressList } from '../StealthAddressList'

const fakePosition = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  balance: '2500000000',
  balanceUiAmount: 2.5,
  lockedAmount: '0',
  decimals: 9,
  lastDepositAt: 1715000000,
  refundableAt: 1715086400,
  cooldownActive: true,
  depositRecordAddress: 'DEPOSITRECORDPDA',
}

const fakeNode = {
  index: 0,
  derivationPath: "m/0'",
  stealthAddress: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  parentIndex: null,
  createdAt: '2026-05-08T00:00:00Z',
}

describe('StealthAddressList', () => {
  it('renders the Vault Positions section with one row per position', () => {
    render(
      <StealthAddressList positions={[fakePosition]} stealthTree={[fakeNode]} loading={false} />
    )
    expect(screen.getByText(/Vault Positions/i)).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText(/2\.5/)).toBeInTheDocument()
  })

  it('renders the Stealth Tree section with one row per node', () => {
    render(<StealthAddressList positions={[]} stealthTree={[fakeNode]} loading={false} />)
    // The literal section header (uppercased "STEALTH TREE") is unique;
    // the M19 banner copy mentions "stealth tree" in lowercase, so anchor
    // on the eyebrow label here.
    expect(screen.getByText('STEALTH TREE')).toBeInTheDocument()
    expect(screen.getByText("m/0'")).toBeInTheDocument()
  })

  it('renders M19 banner when stealthTree has only the root node', () => {
    render(<StealthAddressList positions={[]} stealthTree={[fakeNode]} loading={false} />)
    expect(screen.getByText(/M19/i)).toBeInTheDocument()
  })

  it('renders empty-positions empty-state copy', () => {
    render(<StealthAddressList positions={[]} stealthTree={[]} loading={false} />)
    expect(screen.getByText(/no vault positions yet/i)).toBeInTheDocument()
  })

  it('renders loading state when loading=true', () => {
    render(<StealthAddressList positions={[]} stealthTree={[]} loading={true} />)
    // Both sections render "Loading…" independently when loading=true,
    // so assert on the count rather than uniqueness.
    expect(screen.getAllByText(/loading/i)).toHaveLength(2)
  })
})
