import { useEffect, useRef, useState } from 'react'
import { Copy, ArrowsClockwise, Plug, CaretDown, Gear, Broadcast, UsersThree } from '@phosphor-icons/react'

type AdminView = 'settings' | 'herald' | 'squad'

interface Props {
  address: string
  isAdmin: boolean
  onCopy: () => void
  onReSignIn: () => void
  onDisconnect: () => void
  onNavigate: (view: AdminView) => void
}

export function UserMenu({ address, isAdmin, onCopy, onReSignIn, onDisconnect, onNavigate }: Props) {
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

  const handleNavigate = (view: AdminView) => () => {
    onNavigate(view)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 bg-glass-2 border border-line rounded text-xs text-text hover:bg-text/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{short}</span>
        <CaretDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 bg-glass-2 border border-line rounded shadow-lg overflow-hidden z-50"
        >
          {isAdmin && (
            <>
              <div className="px-3 pt-2 pb-1 text-2xs text-text-muted tracking-widest uppercase">
                Admin
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleNavigate('settings')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
              >
                <Gear size={14} /> Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleNavigate('herald')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
              >
                <Broadcast size={14} /> Herald
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleNavigate('squad')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
              >
                <UsersThree size={14} /> Squad
              </button>
              <div className="border-t border-line" />
            </>
          )}
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
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5 border-t border-line"
          >
            <Plug size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
