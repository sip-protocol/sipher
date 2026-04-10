import { useAppStore } from '../stores/app'

export function useIsAdmin() {
  return useAppStore((s) => s.isAdmin)
}
