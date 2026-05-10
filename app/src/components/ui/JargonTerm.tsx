import type { ReactNode } from 'react'
import { Info } from '@phosphor-icons/react'
import { Tooltip } from './Tooltip'

export const JARGON_DEFINITIONS = {
  'Privacy Score':
    'Composite metric of address reuse, amount patterns, timing correlation, and counterparty exposure. Higher = more private.',
  'Stealth Address Tree':
    'Each leaf is a one-time recipient address. Connecting your wallet derives the tree from your viewing key.',
  'Vault PDA':
    'Program-Derived Address — the on-chain account holding shielded vault state. Owned by the Sipher Vault program, not by any wallet.',
  'fee 50 bps':
    '0.5% fee on shielded transfers — funds protocol development. Paid in the transferred token.',
  'Pedersen':
    'Cryptographic commitment scheme used to hide amounts. Each commitment combines value × G + blinding × H, where G and H are base points on the secp256k1 curve.',
  'DKSAP':
    "Dual-Key Stealth Address Protocol — sender derives a one-time recipient address from the recipient's spending + viewing public keys. Only the recipient can spend.",
} as const

export type JargonKey = keyof typeof JARGON_DEFINITIONS

export interface JargonTermProps {
  term: JargonKey
  children: ReactNode
}

export function JargonTerm({ term, children }: JargonTermProps) {
  return (
    <Tooltip content={JARGON_DEFINITIONS[term]}>
      <button type="button" className="inline-flex items-center gap-1 cursor-help underline decoration-dotted">
        {children}
        <Info size={12} className="text-text-muted" />
      </button>
    </Tooltip>
  )
}
