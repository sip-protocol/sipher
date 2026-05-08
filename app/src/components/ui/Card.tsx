import { ReactNode, HTMLAttributes } from 'react'

type CardVariant = 'default' | 'elevated' | 'strong'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: CardVariant
  sheen?: boolean
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'glass-1',
  elevated: 'glass-2',
  strong: 'glass-strong',
}

export function Card({ children, variant = 'default', sheen = false, className = '', ...rest }: CardProps) {
  const classes = [VARIANT_CLASS[variant], sheen ? 'glass-sheen' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
