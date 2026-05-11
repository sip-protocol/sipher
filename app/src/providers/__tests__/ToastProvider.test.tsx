import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../ToastProvider'

function TriggerButton({ input }: { input: Parameters<ReturnType<typeof useToast>['show']>[0] }) {
  const { show } = useToast()
  return <button onClick={() => show(input)}>Trigger</button>
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ToastProvider', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <span>child</span>
      </ToastProvider>,
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('shows toast when show() called', () => {
    render(
      <ToastProvider>
        <TriggerButton input={{ message: 'Hello world', kind: 'info' }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders action button if action provided', () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <TriggerButton
          input={{
            message: 'Session expired',
            kind: 'warn',
            action: { label: 'Sign in', onClick: onAction },
          }}
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Trigger'))
    const actionButton = screen.getByText('Sign in')
    expect(actionButton).toBeInTheDocument()

    fireEvent.click(actionButton)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Session expired')).not.toBeInTheDocument()
  })

  it('dismisses toast on close button click', () => {
    render(
      <ToastProvider>
        <TriggerButton input={{ message: 'Bye', kind: 'info' }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByText('Bye')).toBeInTheDocument()

    const dismissBtn = screen.getByLabelText('Dismiss')
    fireEvent.click(dismissBtn)
    expect(screen.queryByText('Bye')).not.toBeInTheDocument()
  })

  it('auto-dismisses after default 7 seconds', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <TriggerButton input={{ message: 'Auto', kind: 'info' }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByText('Auto')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(7000)
    })
    expect(screen.queryByText('Auto')).not.toBeInTheDocument()
  })

  it('does not auto-dismiss when durationMs is 0', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <TriggerButton input={{ message: 'Sticky', kind: 'error', durationMs: 0 }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Trigger'))

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Sticky')).toBeInTheDocument()
  })

  it('uses warn styles for kind=warn', () => {
    render(
      <ToastProvider>
        <TriggerButton input={{ message: 'Warn me', kind: 'warn' }} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Trigger'))
    // warn upgrades to role="alert" + aria-live="assertive" per Toast aria
    // semantics; info/success keep role="status" + aria-live="polite".
    const toast = screen.getByText('Warn me').closest('[role="alert"]')
    expect(toast).toHaveClass('bg-amber-950/90')
  })

  it('throws when useToast called outside provider', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bad() {
      useToast()
      return null
    }
    expect(() => render(<Bad />)).toThrow(/useToast must be used within ToastProvider/)
    errSpy.mockRestore()
  })
})
