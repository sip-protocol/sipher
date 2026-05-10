import { useAuthState } from './useAuthState'

export function useIsAdmin(): boolean {
  return useAuthState().isAdmin
}
