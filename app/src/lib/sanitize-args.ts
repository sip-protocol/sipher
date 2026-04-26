const SENSITIVE_KEY = /private|secret|mnemonic|password|seed/i
const BASE58_HEX = /^(?=.*\d)[A-Za-z0-9]{12,}$/
const MAX_STRING = 40

function shortenIdent(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    if (BASE58_HEX.test(value)) return shortenIdent(value)
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…' : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function sanitizeArgs(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([k]) => !SENSITIVE_KEY.test(k))
    .map(([k, v]) => `${k}=${formatValue(v)}`)
    .filter(s => !s.endsWith('='))
  return entries.join(', ')
}
