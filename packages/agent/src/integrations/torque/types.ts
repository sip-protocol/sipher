/**
 * Event emitted to Torque MCP after a successful fund-moving sipher tool call.
 * Wallet field is required for attribution; rebate_destination is a fresh
 * stealth address derived per event so Torque does not learn the user's
 * recipient identity.
 */
export interface SipherGrowthEvent {
  event: SipherEventName
  wallet: string
  ts: string
  tx_signature: string
  network: 'mainnet-beta' | 'devnet'
  metadata: {
    amount_lamports?: number
    asset?: string
    rebate_destination: string
  }
}

export type SipherEventName =
  | 'sipher.private_send_completed'
  | 'sipher.private_swap_completed'
  | 'sipher.private_claim_completed'
  | 'sipher.recurring_send_tick'
  | 'sipher.batch_send_completed'

export interface TorqueCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ENDED'
  remainingPool: number
  rewardAmountPerEvent: number
  rewardToken: string
}

export interface TorqueMCPClientOptions {
  baseUrl: string
  apiKey: string
  campaignId: string
  /** ms; default 8000 */
  timeoutMs?: number
}

export type TorqueEmitResult =
  | { ok: true; eventId: string }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'duplicate' | 'campaign_inactive' | 'unknown'; message: string }
