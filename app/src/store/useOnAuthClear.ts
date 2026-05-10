import { useEffect, useRef } from 'react'
import { onAuthClear } from './onAuthClear'

/**
 * Register a cleanup callback that fires when the auth boundary transitions
 * (`'authed' → 'unauthed' | 'expired'`). The callback is unregistered on
 * unmount. The latest callback identity wins across renders — useful for
 * closures over component state that change between renders.
 *
 * Usage:
 *   useOnAuthClear(() => setTree([]))
 */
export function useOnAuthClear(callback: () => void): void {
  const ref = useRef(callback)

  useEffect(() => {
    ref.current = callback
  }, [callback])

  useEffect(() => {
    return onAuthClear.register(() => ref.current())
  }, [])
}
