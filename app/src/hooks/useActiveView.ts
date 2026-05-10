import { useLocation } from 'react-router-dom'
import type { View } from '../stores/app'

const PATH_TO_VIEW: Record<string, View> = {
  '/': 'dashboard',
  '/vault': 'vault',
  '/vault/deposit': 'deposit',
  '/vault/withdraw': 'withdraw',
  '/chains': 'chains',
  '/keys': 'keys',
  '/chat': 'chat',
  '/herald': 'herald',
  '/sentinel': 'squad',
  '/settings': 'settings',
  '/privacy-report': 'privacyReport',
  '/about': 'about',
}

export function useActiveView(): View {
  const { pathname } = useLocation()
  return PATH_TO_VIEW[pathname] ?? 'dashboard'
}
