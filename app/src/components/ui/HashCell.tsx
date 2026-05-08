import { ButtonHTMLAttributes } from 'react'

interface HashCellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'title'> {
  hash: string
  headChars?: number
  tailChars?: number
}

function truncate(hash: string, head: number, tail: number): string {
  if (hash.length <= head + tail) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

export function HashCell({
  hash,
  headChars = 4,
  tailChars = 4,
  className = '',
  'aria-label': ariaLabel,
  ...rest
}: HashCellProps) {
  const display = truncate(hash, headChars, tailChars)
  const handleCopy = () => {
    navigator.clipboard?.writeText(hash).catch((err) => {
      console.warn('[HashCell] clipboard write failed', err)
    })
  }
  return (
    <button
      type="button"
      title={hash}
      aria-label={ariaLabel ?? `Copy ${hash}`}
      onClick={handleCopy}
      className={`inline-flex items-center font-mono text-xs text-text-secondary hover:text-text transition-colors ${className}`}
      {...rest}
    >
      {display}
    </button>
  )
}
