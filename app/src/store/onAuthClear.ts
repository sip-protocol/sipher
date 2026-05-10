type ClearCallback = () => void

interface OnAuthClearRegistry {
  register(cb: ClearCallback): () => void
  clearAll(): void
  /**
   * Test-only helper. Drops all callbacks. Production code should never call
   * this — production cleanup happens via the unsubscribe returned by
   * `register`.
   */
  _resetForTests(): void
}

function createRegistry(): OnAuthClearRegistry {
  const callbacks = new Set<ClearCallback>()

  return {
    register(cb) {
      callbacks.add(cb)
      return () => {
        callbacks.delete(cb)
      }
    },
    clearAll() {
      // Snapshot to a list so a callback that registers/unregisters during
      // iteration does not skew the loop.
      const snapshot = Array.from(callbacks)
      for (const cb of snapshot) {
        try {
          cb()
        } catch {
          // A consumer's cleanup throwing should not block other consumers.
          // Swallow; auth-clear is best-effort UI cleanup.
        }
      }
    },
    _resetForTests() {
      callbacks.clear()
    },
  }
}

/**
 * Module-singleton registry of "clear cached UI state on auth boundary"
 * callbacks. The auth store calls `clearAll()` from inside `clearAuth()` —
 * outside React render — so the registry must be callable without a hook
 * context.
 *
 * Component consumers should use the `useOnAuthClear` thin hook (in
 * `app/src/store/useOnAuthClear.ts`) instead of calling `register` directly,
 * so unsubscribe is wired to component unmount via `useEffect` cleanup.
 */
export const onAuthClear: OnAuthClearRegistry = createRegistry()
