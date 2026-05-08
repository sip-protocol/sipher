import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetSelector } from '../AssetSelector'

describe('AssetSelector', () => {
  it('renders one button per asset', () => {
    render(<AssetSelector assets={['SOL', 'USDC', 'USDT']} value="SOL" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDT' })).toBeInTheDocument()
  })

  it('marks the selected asset with aria-pressed=true', () => {
    render(<AssetSelector assets={['SOL', 'USDC', 'USDT']} value="USDC" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'USDC' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'SOL' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange when a different asset is clicked', () => {
    const onChange = vi.fn()
    render(<AssetSelector assets={['SOL', 'USDC', 'USDT']} value="SOL" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))
    expect(onChange).toHaveBeenCalledWith('USDC')
  })
})
