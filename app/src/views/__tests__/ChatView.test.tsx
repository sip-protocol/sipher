import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ChatView from '../ChatView'

vi.mock('../../components/ChatSidebar', () => ({
  default: ({ fullScreen }: { fullScreen?: boolean }) => (
    <div data-testid="chat-sidebar-mock">{fullScreen ? 'full' : 'sheet'}</div>
  ),
}))

describe('ChatView', () => {
  it('renders ChatSidebar in fullScreen mode', () => {
    render(<ChatView />)
    expect(screen.getByTestId('chat-sidebar-mock')).toHaveTextContent('full')
  })
})
