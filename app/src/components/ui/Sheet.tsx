import { ReactNode, useEffect, useRef } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
}

export function Sheet({ open, onClose, children, ariaLabel = 'Sheet' }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        data-testid="sheet-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-overlay"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="fixed top-0 right-0 h-full w-full max-w-[420px] z-modal glass-strong overflow-y-auto outline-none"
        style={{
          animation: 'drawer-slide-in var(--duration-slow) var(--ease-out-expo) both',
        }}
      >
        {children}
      </div>
    </>
  )
}
