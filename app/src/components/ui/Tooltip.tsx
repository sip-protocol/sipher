import { cloneElement, useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    },
  } as Record<string, unknown>)

  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`absolute z-tooltip whitespace-pre-line max-w-xs glass-strong rounded-md px-2 py-1.5 text-2xs text-text shadow-lg ${SIDE_CLASSES[side]}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
