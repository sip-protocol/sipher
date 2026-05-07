import { useEffect, useRef, useState } from 'react'
import { Copy, ArrowsClockwise, Plug, CaretDown } from '@phosphor-icons/react'

interface Props {
  address: string
  onCopy: () => void
  onReSignIn: () => void
  onDisconnect: () => void
}

export function WalletDropdown({ address, onCopy, onReSignIn, onDisconnect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleAction = (cb: () => void) => () => {
    cb()
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 bg-elevated border border-border rounded text-xs text-text hover:bg-text/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{short}</span>
        <CaretDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 bg-elevated border border-border rounded shadow-lg overflow-hidden z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleAction(onCopy)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
          >
            <Copy size={14} /> Copy address
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleAction(onReSignIn)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
          >
            <ArrowsClockwise size={14} /> Re-sign in
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleAction(onDisconnect)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5 border-t border-border"
          >
            <Plug size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
