import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAppStore } from '../../stores/app'
import AdminOnly from '../AdminOnly'

describe('AdminOnly', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, messages: [], chatLoading: false })
  })

  it('renders children when isAdmin is true', () => {
    useAppStore.setState({ isAdmin: true })
    render(<AdminOnly><div>secret</div></AdminOnly>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders null by default when isAdmin is false', () => {
    useAppStore.setState({ isAdmin: false })
    const { container } = render(<AdminOnly><div>secret</div></AdminOnly>)
    expect(container.firstChild).toBeNull()
  })

  it('renders fallback when isAdmin is false and fallback provided', () => {
    useAppStore.setState({ isAdmin: false })
    render(<AdminOnly fallback={<div>upgrade</div>}><div>secret</div></AdminOnly>)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText('upgrade')).toBeInTheDocument()
  })
})
