// packages/agent/src/data/known-addresses.ts

/** Top exchange deposit/hot wallet addresses on Solana with their labels. */
export const EXCHANGE_ADDRESSES: Record<string, string> = {
  '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP': 'Binance',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Binance',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S': 'Binance',
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7TjN': 'Coinbase',
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS': 'Coinbase',
  'CppSEFkCBfB73miH4rdGrzKzCCXVbMQVVeJFKEkGzuH4': 'Kraken',
  '5VCwKtCXgCDuQosV1JB4GhFgocHB49GD3twqJahXL8Cz': 'OKX',
  'AC5RDfQFmDS1deWZos921JfqscXdByf4BKKhF3bEwNkR': 'Bybit',
  'BmFdpraQhkiDQE6SnfG5PK1MHhbjFh5Fy4r4LqtSG5Hk': 'KuCoin',
  'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w': 'Gate.io',
  '88xTWZMeKfiTgbfEmPLdsUCQcZinwUfk25MXBUL87eJx': 'HTX',
  'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATbo3p': 'Crypto.com',
  'GXMaB3TMSQY5YScGMfhRcJMFXCM7JJgqJ8tZJ7SQGL5z': 'FTX (defunct)',
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1': 'Raydium',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
}

export const OFAC_ADDRESSES: Set<string> = new Set([])

export const SCAM_ADDRESSES: Record<string, string> = {}

export function getExchangeLabel(address: string): string | null {
  return EXCHANGE_ADDRESSES[address] ?? null
}

export function isOfacSanctioned(address: string): boolean {
  return OFAC_ADDRESSES.has(address)
}

export function getScamDescription(address: string): string | null {
  return SCAM_ADDRESSES[address] ?? null
}

export function classifyAddress(address: string): {
  type: 'exchange' | 'ofac' | 'scam' | 'unknown'
  label: string | null
} {
  const exchange = getExchangeLabel(address)
  if (exchange) return { type: 'exchange', label: exchange }
  if (isOfacSanctioned(address)) return { type: 'ofac', label: 'OFAC Sanctioned' }
  const scam = getScamDescription(address)
  if (scam) return { type: 'scam', label: scam }
  return { type: 'unknown', label: null }
}
