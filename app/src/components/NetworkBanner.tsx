import { useEffect, useState } from 'react'

export function NetworkBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const handleError = () => setOffline(true)
    const handleRecover = () => setOffline(false)
    window.addEventListener('sipher:network-error', handleError)
    window.addEventListener('sipher:network-recovered', handleRecover)
    return () => {
      window.removeEventListener('sipher:network-error', handleError)
      window.removeEventListener('sipher:network-recovered', handleRecover)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-warning/15 border-b border-warning/30 text-warning px-4 py-2 text-xs flex items-center gap-2 shrink-0"
    >
      <span aria-hidden="true">●</span>
      <span>Network connection lost — checking…</span>
    </div>
  )
}
