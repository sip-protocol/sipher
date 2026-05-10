import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { JargonTerm } from '../JargonTerm'

describe('JargonTerm', () => {
  it('renders the term as the visible label', () => {
    render(<JargonTerm term="Privacy Score">{'Privacy Score'}</JargonTerm>)
    expect(screen.getAllByText('Privacy Score').length).toBeGreaterThan(0)
  })

  it('shows definition on hover for Privacy Score', () => {
    render(<JargonTerm term="Privacy Score">Privacy Score</JargonTerm>)
    const trigger = screen.getByRole('button')
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/composite metric/i)
  })

  it('shows definition for Stealth Address Tree', () => {
    render(<JargonTerm term="Stealth Address Tree">tree</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/one-time recipient/i)
  })

  it('shows definition for Vault PDA', () => {
    render(<JargonTerm term="Vault PDA">PDA</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/program-derived address/i)
  })

  it('shows definition for fee 50 bps', () => {
    render(<JargonTerm term="fee 50 bps">50 bps</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/0\.5%/)
  })

  it('shows definition for Pedersen', () => {
    render(<JargonTerm term="Pedersen">Pedersen</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/commitment scheme/i)
  })

  it('shows definition for DKSAP', () => {
    render(<JargonTerm term="DKSAP">DKSAP</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/dual-key/i)
  })
})
