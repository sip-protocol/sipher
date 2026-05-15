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

describe('useAppStore.markMessageExpired', () => {
  beforeEach(() => {
    useAppStore.setState({ messages: [] }, false)
  })

  const baseSigningMsg = {
    id: 'msg-1',
    role: 'system' as const,
    content: '',
    kind: 'tool_signing_required' as const,
    meta: { flagId: 'flag-abc', toolName: 'send' as const },
  }

  it('marks the matching tool_signing_required message expired by flagId', () => {
    useAppStore.setState({ messages: [baseSigningMsg] })
    useAppStore.getState().markMessageExpired('flag-abc')
    const msg = useAppStore.getState().messages[0]
    expect(msg.expired).toBe(true)
  })

  it('is a no-op when no message matches the flagId', () => {
    useAppStore.setState({ messages: [baseSigningMsg] })
    useAppStore.getState().markMessageExpired('flag-OTHER')
    const msg = useAppStore.getState().messages[0]
    expect(msg.expired).toBeUndefined()
  })

  it('skips non-signing messages even when meta.flagId happens to match', () => {
    const sentinelMsg = {
      id: 'msg-2',
      role: 'system' as const,
      content: '',
      kind: 'sentinel_pause' as const,
      meta: { flagId: 'flag-abc' },
    }
    useAppStore.setState({ messages: [sentinelMsg] })
    useAppStore.getState().markMessageExpired('flag-abc')
    const msg = useAppStore.getState().messages[0]
    expect(msg.expired).toBeUndefined()
  })

  it('skips already-dismissed messages (race protection)', () => {
    useAppStore.setState({ messages: [{ ...baseSigningMsg, dismissed: true }] })
    useAppStore.getState().markMessageExpired('flag-abc')
    const msg = useAppStore.getState().messages[0]
    expect(msg.expired).toBeUndefined()
  })

  it('skips already-expired messages (idempotent)', () => {
    useAppStore.setState({ messages: [{ ...baseSigningMsg, expired: true }] })
    // Snapshot the array reference; idempotent should leave entries untouched
    const before = useAppStore.getState().messages
    useAppStore.getState().markMessageExpired('flag-abc')
    const after = useAppStore.getState().messages
    // The message itself remains expired; we just confirm no double-mutation
    expect(after[0].expired).toBe(true)
    expect(after[0]).toBe(before[0])
  })

  it('only updates the matched message; leaves siblings alone', () => {
    const other = { ...baseSigningMsg, id: 'msg-other', meta: { flagId: 'flag-XYZ' } }
    useAppStore.setState({ messages: [baseSigningMsg, other] })
    useAppStore.getState().markMessageExpired('flag-abc')
    const msgs = useAppStore.getState().messages
    expect(msgs[0].expired).toBe(true)
    expect(msgs[1].expired).toBeUndefined()
  })
})
