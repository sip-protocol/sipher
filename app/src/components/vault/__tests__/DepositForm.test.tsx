import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DepositForm } from '../DepositForm'

vi.mock('../../../lib/networkConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/networkConfig')>()
  return {
    ...actual,
    useNetworkConfigStore: <T,>(selector: (s: { config: { solscanSuffix: string } }) => T) =>
      selector({ config: { solscanSuffix: '?cluster=devnet' } }),
  }
})

const baseProps = {
  onSubmit: vi.fn(),
  maxByAsset: { SOL: 5, USDC: 100, USDT: 100 },
  disabled: false,
  status: 'idle' as const,
}

describe('DepositForm', () => {
  it('renders an AssetSelector with SOL, USDC, USDT', () => {
    render(<DepositForm {...baseProps} />)
    expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDT' })).toBeInTheDocument()
  })

  it('renders an amount input with the SOL max by default', () => {
    render(<DepositForm {...baseProps} />)
    expect(screen.getByText(/Max:.*5/)).toBeInTheDocument()
  })

  it('switches max when AssetSelector value changes', () => {
    render(<DepositForm {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))
    expect(screen.getByText(/Max:.*100/)).toBeInTheDocument()
  })

  it('calls onSubmit with (amount, asset) when AmountForm submits', () => {
    const onSubmit = vi.fn()
    render(<DepositForm {...baseProps} onSubmit={onSubmit} />)
    const input = screen.getByPlaceholderText('0.0')
    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onSubmit).toHaveBeenCalledWith(1.5, 'SOL')
  })

  it('renders TxStatusBadge based on status prop', () => {
    render(<DepositForm {...baseProps} status="signing" />)
    expect(screen.getByText(/signing/i)).toBeInTheDocument()
  })

  it('passes the selected asset as assetSymbol to AmountForm', () => {
    render(<DepositForm {...baseProps} />)
    // Default selected asset is SOL — AmountForm should render SOL label
    expect(screen.getByText(/Max:\s*5\s*SOL/)).toBeInTheDocument()
    // Switch to USDC — AmountForm should re-render with USDC label
    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))
    expect(screen.getByText(/Max:\s*100\s*USDC/)).toBeInTheDocument()
    expect(screen.queryByText(/Max:\s*100\s*SOL/)).not.toBeInTheDocument()
    // Switch to USDT — AmountForm should re-render with USDT label
    fireEvent.click(screen.getByRole('button', { name: 'USDT' }))
    expect(screen.getByText(/Max:\s*100\s*USDT/)).toBeInTheDocument()
  })
})
