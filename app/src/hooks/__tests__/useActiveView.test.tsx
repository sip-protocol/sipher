import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useActiveView } from '../useActiveView'

function wrapper(initialEntries: string[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  )
}

describe('useActiveView', () => {
  it('maps / to dashboard', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/']) })
    expect(result.current).toBe('dashboard')
  })

  it('maps /vault to vault', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/vault']) })
    expect(result.current).toBe('vault')
  })

  it('maps /vault/deposit to deposit', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/vault/deposit']) })
    expect(result.current).toBe('deposit')
  })

  it('maps /vault/withdraw to withdraw', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/vault/withdraw']) })
    expect(result.current).toBe('withdraw')
  })

  it('maps /chains, /keys, /chat to their views', () => {
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/chains']) }).result.current).toBe('chains')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/keys']) }).result.current).toBe('keys')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/chat']) }).result.current).toBe('chat')
  })

  it('maps /sentinel to squad (View enum name)', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/sentinel']) })
    expect(result.current).toBe('squad')
  })

  it('maps /herald, /settings, /privacy-report, /about', () => {
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/herald']) }).result.current).toBe('herald')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/settings']) }).result.current).toBe('settings')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/privacy-report']) }).result.current).toBe('privacyReport')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/about']) }).result.current).toBe('about')
  })

  it('returns null for unknown paths', () => {
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/unknown']) }).result.current).toBe(null)
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/vault/abc']) }).result.current).toBe(null)
  })
})
