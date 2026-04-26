import type { ReactNode } from 'react'
import { useIsAdmin } from '../hooks/useIsAdmin'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export default function AdminOnly({ children, fallback = null }: Props) {
  return useIsAdmin() ? <>{children}</> : <>{fallback}</>
}
