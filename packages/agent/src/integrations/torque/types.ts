/**
 * Event emitted to Torque ingest after a successful fund-moving sipher tool call.
 * Shape mirrors Torque's canonical ingest contract — flat top-level fields
 * with a `data` sub-object whose values are string|number|boolean only.
 *
 * userPubkey is required for attribution. `data.rebate_destination` carries
 * the per-event fresh stealth address so Torque cannot learn the recipient
 * identity.
 */
export interface SipherGrowthEvent {
  userPubkey: string
  /** ms-epoch number, NOT ISO string */
  timestamp: number
  eventName: SipherEventName
  data: SipherGrowthEventData
}

export interface SipherGrowthEventData {
  tx_signature: string
  network: 'mainnet-beta' | 'devnet'
  rebate_destination: string
  /** Present only on swap events for amount attribution */
  amount_lamports?: number
  /** Present only on swap events */
  asset?: string
}

export type SipherEventName =
  | 'sipher_private_send_completed'
  | 'sipher_private_swap_completed'
  | 'sipher_private_claim_completed'
  | 'sipher_private_drip_completed'
  | 'sipher_private_split_send_completed'

export interface TorqueMCPClientOptions {
  ingesterUrl: string
  apiToken: string
  /** ms; default 8000 */
  timeoutMs?: number
}

export type TorqueEmitResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'event_undefined' | 'validation' | 'unknown'; message: string }

export type TorquePingResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'network' | 'unknown'; message: string }
