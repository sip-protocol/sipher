import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAppStore } from '../../stores/app'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'
import AdminOnly from '../AdminOnly'

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))

import { useAuthState } from '../../hooks/useAuthState'

describe('AdminOnly', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, messages: [], chatLoading: false })
    vi.mocked(useAuthState).mockReset()
  })

  it('renders children when isAdmin is true', () => {
    vi.mocked(useAuthState).mockReturnValue(makeFakeAuthState({ isAdmin: true }))
    render(<AdminOnly><div>secret</div></AdminOnly>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders null by default when isAdmin is false', () => {
    vi.mocked(useAuthState).mockReturnValue(makeFakeAuthState({ isAdmin: false }))
    const { container } = render(<AdminOnly><div>secret</div></AdminOnly>)
    expect(container.firstChild).toBeNull()
  })

  it('renders fallback when isAdmin is false and fallback provided', () => {
    vi.mocked(useAuthState).mockReturnValue(makeFakeAuthState({ isAdmin: false }))
    render(<AdminOnly fallback={<div>upgrade</div>}><div>secret</div></AdminOnly>)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText('upgrade')).toBeInTheDocument()
  })
})
