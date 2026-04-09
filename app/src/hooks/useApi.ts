import { useCallback } from 'react'
import { apiFetch } from '../api/client'

export function useApi(token: string | null) {
  const authFetch = useCallback(<T>(path: string, options?: RequestInit) => {
    return apiFetch<T>(path, { ...options, token: token ?? undefined })
  }, [token])

  return { fetch: authFetch }
}
