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

export function HashCell({ hash, headChars = 4, tailChars = 4, className = '', ...rest }: HashCellProps) {
  const display = truncate(hash, headChars, tailChars)
  const handleCopy = () => {
    navigator.clipboard?.writeText(hash).catch(() => { /* clipboard denied — silent */ })
  }
  return (
    <button
      type="button"
      title={hash}
      onClick={handleCopy}
      className={`inline-flex items-center font-mono text-xs text-text-secondary hover:text-text transition-colors ${className}`}
      {...rest}
    >
      {display}
    </button>
  )
}
