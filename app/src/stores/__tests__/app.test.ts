import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../app'
import { onAuthClear } from '../../store/onAuthClear'

describe('app store — chatSheetOpen slice', () => {
  beforeEach(() => {
    useAppStore.setState({ chatSheetOpen: false }, false)
  })

  it('defaults to closed', () => {
    expect(useAppStore.getState().chatSheetOpen).toBe(false)
  })

  it('toggles via setChatSheetOpen', () => {
    useAppStore.getState().setChatSheetOpen(true)
    expect(useAppStore.getState().chatSheetOpen).toBe(true)
    useAppStore.getState().setChatSheetOpen(false)
    expect(useAppStore.getState().chatSheetOpen).toBe(false)
  })

  it('is excluded from persisted partialize (in-memory only)', () => {
    useAppStore.getState().setChatSheetOpen(true)
    const persisted = JSON.parse(localStorage.getItem('sipher-auth') ?? '{}')
    expect(persisted.state).not.toHaveProperty('chatSheetOpen')
  })
})

describe('useAppStore.clearAuth', () => {
  beforeEach(() => {
    onAuthClear._resetForTests()
  })

  it('fires onAuthClear.clearAll after store reset', () => {
    const cb = vi.fn()
    onAuthClear.register(cb)
    useAppStore.getState().setAuth('test-token', false, null)
    useAppStore.getState().clearAuth()
    expect(cb).toHaveBeenCalledOnce()
  })

  it('clears token before firing onAuthClear (consumers see empty state)', () => {
    let observedToken: string | null | undefined
    onAuthClear.register(() => {
      observedToken = useAppStore.getState().token
    })
    useAppStore.getState().setAuth('test-token', false, null)
    useAppStore.getState().clearAuth()
    expect(observedToken).toBeNull()
  })
})
