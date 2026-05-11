import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Toast } from '../Toast'

describe('Toast aria semantics', () => {
  it('info kind uses role=status + aria-live=polite', () => {
    const { container } = render(
      <Toast toast={{ message: 'hello', kind: 'info' }} onDismiss={() => {}} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('status')
    expect(root.getAttribute('aria-live')).toBe('polite')
  })

  it('success kind uses role=status + aria-live=polite', () => {
    const { container } = render(
      <Toast toast={{ message: 'done', kind: 'success' }} onDismiss={() => {}} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('status')
    expect(root.getAttribute('aria-live')).toBe('polite')
  })

  it('warn kind uses role=alert + aria-live=assertive', () => {
    const { container } = render(
      <Toast toast={{ message: 'check this', kind: 'warn' }} onDismiss={() => {}} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('alert')
    expect(root.getAttribute('aria-live')).toBe('assertive')
  })

  it('error kind uses role=alert + aria-live=assertive', () => {
    const { container } = render(
      <Toast toast={{ message: 'oops', kind: 'error' }} onDismiss={() => {}} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('alert')
    expect(root.getAttribute('aria-live')).toBe('assertive')
  })

  it('defaults to info semantics when kind is omitted', () => {
    const { container } = render(
      <Toast toast={{ message: 'no kind' }} onDismiss={() => {}} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('status')
    expect(root.getAttribute('aria-live')).toBe('polite')
  })
})
