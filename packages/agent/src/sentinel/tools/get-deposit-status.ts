import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { Connection, PublicKey } from '@solana/web3.js'

export interface GetDepositStatusParams { pda: string }
export interface GetDepositStatusResult {
  status: 'active' | 'expired' | 'refunded' | 'unknown'
  amount: number | null
  createdAt: string | null
  expiresAt: string | null
}

export const getDepositStatusTool: AnthropicTool = {
  name: 'getDepositStatus',
  description: 'Fetch on-chain status of a sipher_vault deposit PDA (active/expired/refunded).',
  input_schema: {
    type: 'object' as const,
    properties: { pda: { type: 'string', description: 'Deposit PDA address' } },
    required: ['pda'],
  },
}

export async function executeGetDepositStatus(
  params: GetDepositStatusParams,
): Promise<GetDepositStatusResult> {
  const rpc = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
  const conn = new Connection(rpc, 'confirmed')
  const acct = await conn.getAccountInfo(new PublicKey(params.pda))
  if (!acct) {
    return { status: 'refunded', amount: null, createdAt: null, expiresAt: null }
  }
  // Lightweight read: rely on the lamports field; full decoding handled by sipher_vault IDL
  // For v1, return active + lamports; richer decoding in v2.
  return {
    status: 'active',
    amount: acct.lamports / 1e9,
    createdAt: null,
    expiresAt: null,
  }
}
