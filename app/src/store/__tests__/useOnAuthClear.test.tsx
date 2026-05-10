import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOnAuthClear } from '../useOnAuthClear'
import { onAuthClear } from '../onAuthClear'

describe('useOnAuthClear', () => {
  beforeEach(() => {
    onAuthClear._resetForTests()
  })

  it('registers the callback on mount', () => {
    const cb = vi.fn()
    renderHook(() => useOnAuthClear(cb))
    onAuthClear.clearAll()
    expect(cb).toHaveBeenCalledOnce()
  })

  it('unregisters the callback on unmount', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useOnAuthClear(cb))
    unmount()
    onAuthClear.clearAll()
    expect(cb).not.toHaveBeenCalled()
  })

  it('uses the latest callback identity across renders', () => {
    const a = vi.fn()
    const b = vi.fn()
    const { rerender } = renderHook(({ cb }) => useOnAuthClear(cb), {
      initialProps: { cb: a },
    })
    rerender({ cb: b })
    onAuthClear.clearAll()
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledOnce()
  })
})
