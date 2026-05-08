import { ReactNode, useEffect } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
}

export function Sheet({ open, onClose, children, ariaLabel = 'Sheet' }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        data-testid="sheet-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-overlay"
        style={{ animation: 'pulse-bloom var(--duration-bloom) ease-in-out infinite' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="fixed top-0 right-0 h-full w-full max-w-[420px] z-modal glass-strong overflow-y-auto"
        style={{
          animation: 'drawer-slide-in var(--duration-slow) var(--ease-out-expo) both',
        }}
      >
        {children}
      </div>
    </>
  )
}
