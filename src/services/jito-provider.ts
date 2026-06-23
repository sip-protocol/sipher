import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { LRUCache } from 'lru-cache'
import { CACHE_MAX_DEFAULT, TWO_HOURS_MS } from '../constants.js'
import { env } from '../config.js'

// ─── Constants ──────────────────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-JITO-BUNDLE')

/** Real Jito mainnet tip accounts */
export const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVqkfRtQ7NmXwkiY294pay',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSLmWbTAq4hmMr1MczX',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
]

// ─── Types ──────────────────────────────────────────────────────────────────

export type BundleStatus = 'submitted' | 'bundled' | 'confirming' | 'confirmed'

export interface BundleEntry {
  id: string
  transactions: string[]
  tipAccount: string
  tipLamports: string
  gasSponsored: boolean
  submittedAt: number
  precomputedSignature: string
  precomputedSlot: number
}

export interface SubmitBundleParams {
  transactions: string[]
  tipLamports?: string
  gasSponsorship?: boolean
}

export interface SubmitBundleResult {
  bundleId: string
  status: BundleStatus
  tipAccount: string
  tipLamports: string
  gasSponsored: boolean
  slot: number
  signature: string
  estimatedConfirmation: number
}

export interface BundleStatusResult {
  bundleId: string
  status: BundleStatus
  progress: number
  slot: number
  signature: string
  confirmedAt?: number
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const bundleCache = new LRUCache<string, BundleEntry>({
  max: CACHE_MAX_DEFAULT,
  ttl: TWO_HOURS_MS,
})

/** Maps our jito_ prefixed IDs to raw Jito hex IDs for real mode lookups */
const realBundleIdMap = new LRUCache<string, string>({
  max: CACHE_MAX_DEFAULT,
  ttl: TWO_HOURS_MS,
})

// ─── State Machine Thresholds (ms) ─────────────────────────────────────────

const STATUS_THRESHOLDS = {
  submitted: 0,
  bundled: 500,
  confirming: 1500,
  confirmed: 3000,
}

function getStatus(elapsed: number): { status: BundleStatus; progress: number } {
  if (elapsed >= STATUS_THRESHOLDS.confirmed) return { status: 'confirmed', progress: 100 }
  if (elapsed >= STATUS_THRESHOLDS.confirming) return { status: 'confirming', progress: 66 }
  if (elapsed >= STATUS_THRESHOLDS.bundled) return { status: 'bundled', progress: 33 }
  return { status: 'submitted', progress: 0 }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let mockSeq = 0

function domainHash(label: string, data: string): string {
  const payload = new TextEncoder().encode(label + data)
  const input = new Uint8Array(DOMAIN_TAG.length + payload.length)
  input.set(DOMAIN_TAG)
  input.set(payload, DOMAIN_TAG.length)
  return bytesToHex(keccak_256(input))
}

export function getRandomTipAccount(): string {
  return JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]
}

export function getTipAccounts(): string[] {
  return [...JITO_TIP_ACCOUNTS]
}

let jitoUrlOverride: string | null = null

/** Returns true when JITO_BLOCK_ENGINE_URL is configured */
export function isJitoLive(): boolean {
  const url = jitoUrlOverride ?? env.JITO_BLOCK_ENGINE_URL
  return url.length > 0
}

function getJitoUrl(): string {
  return jitoUrlOverride ?? env.JITO_BLOCK_ENGINE_URL
}

// ─── Jito JSON-RPC Client ───────────────────────────────────────────────────

interface JitoRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: { code: number; message: string }
}

let rpcId = 0

async function jitoRpc<T = unknown>(method: string, params: unknown[]): Promise<T> {
  const url = getJitoUrl()
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: ++rpcId,
    method,
    params,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`Jito RPC HTTP ${res.status}: ${res.statusText}`)
  }

  const json = (await res.json()) as JitoRpcResponse<T>
  if (json.error) {
    throw new Error(`Jito RPC error ${json.error.code}: ${json.error.message}`)
  }

  return json.result as T
}

// ─── Real Mode ──────────────────────────────────────────────────────────────

async function realSubmitBundle(params: SubmitBundleParams): Promise<SubmitBundleResult> {
  const { transactions, tipLamports = '10000', gasSponsorship = false } = params
  const tipAccount = getRandomTipAccount()

  // Jito sendBundle expects array of base64 tx strings
  const rawBundleId = await jitoRpc<string>('sendBundle', [transactions])

  const bundleId = 'jito_' + rawBundleId
  realBundleIdMap.set(bundleId, rawBundleId)

  return {
    bundleId,
    status: 'submitted',
    tipAccount,
    tipLamports,
    gasSponsored: gasSponsorship,
    slot: 0,
    signature: '',
    estimatedConfirmation: Date.now() + 3000,
  }
}

interface JitoBundleStatusValue {
  bundle_id: string
  transactions: string[]
  slot: number
  confirmation_status: 'processed' | 'confirmed' | 'finalized'
}

interface JitoBundleStatusesResult {
  context: { slot: number }
  value: JitoBundleStatusValue[]
}

interface JitoInflightStatus {
  bundle_id: string
  status: 'Invalid' | 'Pending' | 'Failed' | 'Landed'
  landed_slot?: number
}

async function realGetBundleStatus(id: string): Promise<BundleStatusResult | null> {
  const rawId = realBundleIdMap.get(id)
  if (!rawId) return null

  // Try getBundleStatuses first (for landed bundles)
  try {
    const result = await jitoRpc<JitoBundleStatusesResult>('getBundleStatuses', [[rawId]])
    if (result?.value?.length > 0) {
      const entry = result.value[0]
      const sig = entry.transactions?.[0] ?? ''
      const slot = entry.slot ?? 0

      let status: BundleStatus = 'submitted'
      let progress = 0
      if (entry.confirmation_status === 'processed') {
        status = 'confirming'
        progress = 66
      } else if (entry.confirmation_status === 'confirmed' || entry.confirmation_status === 'finalized') {
        status = 'confirmed'
        progress = 100
      }

      const out: BundleStatusResult = { bundleId: id, status, progress, slot, signature: sig }
      if (status === 'confirmed') out.confirmedAt = Date.now()
      return out
    }
  } catch {
    // Fall through to inflight check
  }

  // Fallback: getInflightBundleStatuses (for pending bundles)
  try {
    const inflight = await jitoRpc<JitoInflightStatus[]>('getInflightBundleStatuses', [[rawId]])
    if (inflight?.length > 0) {
      const entry = inflight[0]
      let status: BundleStatus = 'submitted'
      let progress = 0

      if (entry.status === 'Pending') {
        status = 'bundled'
        progress = 33
      } else if (entry.status === 'Landed') {
        status = 'confirmed'
        progress = 100
      }
      // Invalid / Failed stay as 'submitted' with progress 0

      const out: BundleStatusResult = {
        bundleId: id,
        status,
        progress,
        slot: entry.landed_slot ?? 0,
        signature: '',
      }
      if (status === 'confirmed') out.confirmedAt = Date.now()
      return out
    }
  } catch {
    // Both RPCs failed — return null (bundle not found)
  }

  return null
}

// ─── Mock Mode ──────────────────────────────────────────────────────────────

function mockSubmitBundle(params: SubmitBundleParams): SubmitBundleResult {
  const { transactions, tipLamports = '10000', gasSponsorship = false } = params

  const now = Date.now()
  const bundleId = 'jito_' + domainHash('BUNDLE', transactions.join('') + now.toString() + (++mockSeq).toString())
  const tipAccount = getRandomTipAccount()
  const signature = domainHash('SIG', bundleId)
  const slotHash = domainHash('SLOT', bundleId)
  const slot = 280_000_000 + parseInt(slotHash.slice(0, 8), 16) % 1_000_000

  const entry: BundleEntry = {
    id: bundleId,
    transactions,
    tipAccount,
    tipLamports,
    gasSponsored: gasSponsorship,
    submittedAt: now,
    precomputedSignature: signature,
    precomputedSlot: slot,
  }
  bundleCache.set(bundleId, entry)

  return {
    bundleId,
    status: 'submitted',
    tipAccount,
    tipLamports,
    gasSponsored: gasSponsorship,
    slot,
    signature,
    estimatedConfirmation: now + STATUS_THRESHOLDS.confirmed,
  }
}

function mockGetBundleStatus(id: string): BundleStatusResult | null {
  const entry = bundleCache.get(id)
  if (!entry) return null

  const elapsed = Date.now() - entry.submittedAt
  const { status, progress } = getStatus(elapsed)

  const result: BundleStatusResult = {
    bundleId: entry.id,
    status,
    progress,
    slot: entry.precomputedSlot,
    signature: entry.precomputedSignature,
  }

  if (status === 'confirmed') {
    result.confirmedAt = entry.submittedAt + STATUS_THRESHOLDS.confirmed
  }

  return result
}

// ─── Public API (dual-mode dispatch) ────────────────────────────────────────

export async function submitBundle(params: SubmitBundleParams): Promise<SubmitBundleResult> {
  if (isJitoLive()) return realSubmitBundle(params)
  return mockSubmitBundle(params)
}

export async function getBundleStatus(id: string): Promise<BundleStatusResult | null> {
  if (isJitoLive()) return realGetBundleStatus(id)
  return mockGetBundleStatus(id)
}

// ─── Utility ────────────────────────────────────────────────────────────────

export function resetJitoProvider(): void {
  bundleCache.clear()
  realBundleIdMap.clear()
  jitoUrlOverride = null
}

/** Test helper: override Jito Block Engine URL */
export function _setJitoUrl(url: string | null): void {
  jitoUrlOverride = url
}

/** Test helper: override submittedAt to control state machine */
export function _setBundleTimestamp(id: string, ts: number): void {
  const entry = bundleCache.get(id)
  if (entry) {
    entry.submittedAt = ts
    bundleCache.set(id, entry)
  }
}
