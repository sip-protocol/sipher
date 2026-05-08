import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ActivityStreamTable, type ActivityRow } from '../ActivityStreamTable'

const rows: ActivityRow[] = [
  {
    id: 'r1',
    agent: 'sipher',
    type: 'deposit.success',
    level: 'info',
    timestamp: '2026-05-08T03:15:00Z',
    data: { signature: '0x1234567890abcdef1234567890abcdef' },
  },
  {
    id: 'r2',
    agent: 'sipher',
    type: 'withdraw.completed',
    level: 'info',
    timestamp: '2026-05-08T03:10:00Z',
    data: { signature: '0xfedcba0987654321fedcba0987654321' },
  },
  {
    id: 'r3',
    agent: 'herald',
    type: 'relay.observed',
    level: 'info',
    timestamp: '2026-05-08T03:05:00Z',
    data: {},
  },
]

describe('ActivityStreamTable', () => {
  it('renders all rows when filter is ALL', () => {
    render(<ActivityStreamTable rows={rows} />)
    expect(screen.getByText('DEPOSIT.SUCCESS')).toBeInTheDocument()
    expect(screen.getByText('WITHDRAW.COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('RELAY.OBSERVED')).toBeInTheDocument()
  })

  it('clicking DEPOSIT filter narrows to deposit rows only', () => {
    render(<ActivityStreamTable rows={rows} />)
    fireEvent.click(screen.getByRole('button', { name: 'DEPOSIT' }))
    expect(screen.getByText('DEPOSIT.SUCCESS')).toBeInTheDocument()
    expect(screen.queryByText('WITHDRAW.COMPLETED')).not.toBeInTheDocument()
    expect(screen.queryByText('RELAY.OBSERVED')).not.toBeInTheDocument()
  })

  it('renders truncated hash via HashCell when signature is present', () => {
    render(<ActivityStreamTable rows={rows} />)
    expect(screen.getByText('0x12…cdef')).toBeInTheDocument()
    expect(screen.getByText('0xfe…4321')).toBeInTheDocument()
  })

  it('renders em-dash placeholder when row has no signature', () => {
    render(<ActivityStreamTable rows={rows} />)
    const relayRow = screen.getByText('RELAY.OBSERVED').closest('tr')!
    expect(within(relayRow).getByText('—')).toBeInTheDocument()
  })

  it('shows empty-state copy when no rows match the filter', () => {
    render(<ActivityStreamTable rows={[]} />)
    expect(screen.getByText('No activity in the last 24h.')).toBeInTheDocument()
  })

  it('marks the active filter pill via aria-pressed=true', () => {
    render(<ActivityStreamTable rows={rows} />)
    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'WITHDRAW' }))
    expect(screen.getByRole('button', { name: 'WITHDRAW' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'false')
  })
})
