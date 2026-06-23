import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { LRUCache } from 'lru-cache'
import { CACHE_MAX_DEFAULT, ONE_HOUR_MS, ONE_DAY_MS } from '../constants.js'

// ─── Constants ──────────────────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-COMPLIANCE')

// ─── Types ──────────────────────────────────────────────────────────────────

export type DisclosureScopeType = 'time_range' | 'counterparty' | 'amount_threshold' | 'full'

export interface DisclosureScope {
  type: DisclosureScopeType
  startTime?: number
  endTime?: number
  counterparty?: string
  minAmount?: string
}

export interface AuditorVerification {
  auditorKeyHash: string // hex
  nonce: string          // hex
}

export interface DisclosureParams {
  viewingKey: { key: string; path: string; hash: string }
  transactionData: { txHash: string; amount: string; sender: string; receiver: string }
  scope: DisclosureScope
  auditorId: string
  auditorVerification: AuditorVerification
}

export interface DisclosureResult {
  disclosureId: string
  scopedViewingKeyHash: string
  ciphertext: string
  nonce: string
  scope: DisclosureScope
  auditorVerified: boolean
  disclosedAt: number
}

export interface ReportParams {
  viewingKey: { key: string; path: string; hash: string }
  startTime: number
  endTime: number
  auditorId: string
  auditorVerification: AuditorVerification
  includeCounterparties?: boolean
}

export interface ReportEntry {
  reportId: string
  status: 'generated' | 'encrypted'
  generatedAt: number
  expiresAt: number
  summary: {
    totalTransactions: number
    totalVolume: string
    uniqueCounterparties: number
    encryptedTransactions: string[]
  }
  encryptedReport: string
  reportHash: string
}

// ─── Caches ─────────────────────────────────────────────────────────────────

const disclosureCache = new LRUCache<string, DisclosureResult>({
  max: CACHE_MAX_DEFAULT,
  ttl: ONE_HOUR_MS,
})

const reportCache = new LRUCache<string, ReportEntry>({
  max: 1000,
  ttl: ONE_DAY_MS,
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function taggedHash(label: string, data: string): string {
  const input = new Uint8Array(
    DOMAIN_TAG.length + new TextEncoder().encode(label + data).length
  )
  input.set(DOMAIN_TAG)
  input.set(new TextEncoder().encode(label + data), DOMAIN_TAG.length)
  return '0x' + bytesToHex(keccak_256(input))
}

// ─── Auditor Verification ───────────────────────────────────────────────────

export function verifyAuditor(verification: AuditorVerification, viewingKeyHash: string): boolean {
  const expected = taggedHash('AUDITOR', verification.nonce + viewingKeyHash)
  return expected === verification.auditorKeyHash
}

// ─── Create Disclosure ──────────────────────────────────────────────────────

export function createDisclosure(params: DisclosureParams): DisclosureResult {
  const { viewingKey, transactionData, scope, auditorId, auditorVerification } = params

  // Step 1: Verify auditor
  const auditorVerified = verifyAuditor(auditorVerification, viewingKey.hash)
  if (!auditorVerified) {
    const err = new Error('Auditor verification failed: key hash mismatch')
    err.name = 'ComplianceDisclosureError'
    throw err
  }

  // Step 2: Derive scoped viewing key hash
  const scopePath = `${scope.type}/${auditorId}`
  const scopedViewingKeyHash = taggedHash('SCOPED_VK', viewingKey.hash + scopePath)

  // Step 3: Encrypt tx data with scoped key (mock — deterministic ciphertext)
  const txPayload = JSON.stringify(transactionData)
  const ciphertext = taggedHash('ENCRYPT', scopedViewingKeyHash + txPayload)
  const nonce = taggedHash('NONCE', ciphertext + Date.now().toString())

  // Step 4: Build disclosure ID
  const disclosureId = 'cmp_' + bytesToHex(keccak_256(
    new TextEncoder().encode(DOMAIN_TAG + 'DISCLOSURE' + ciphertext + nonce)
  ))

  const result: DisclosureResult = {
    disclosureId,
    scopedViewingKeyHash,
    ciphertext,
    nonce,
    scope,
    auditorVerified: true,
    disclosedAt: Date.now(),
  }

  disclosureCache.set(disclosureId, result)
  return result
}

// ─── Generate Report ────────────────────────────────────────────────────────

export function generateReport(params: ReportParams): ReportEntry {
  const { viewingKey, startTime, endTime, auditorId, auditorVerification, includeCounterparties } = params

  // Step 1: Verify auditor
  const auditorVerified = verifyAuditor(auditorVerification, viewingKey.hash)
  if (!auditorVerified) {
    const err = new Error('Auditor verification failed: key hash mismatch')
    err.name = 'ComplianceReportError'
    throw err
  }

  // Step 2: Generate deterministic mock tx summaries
  const timeRange = `${startTime}-${endTime}`
  const txCountHash = taggedHash('TX_COUNT', viewingKey.hash + timeRange)
  const totalTransactions = 5 + (parseInt(txCountHash.slice(2, 6), 16) % 96) // 5-100

  const volumeHash = taggedHash('VOLUME', viewingKey.hash + timeRange)
  const totalVolume = (BigInt('0x' + volumeHash.slice(2, 18)) % BigInt(10_000_000_000_000)).toString()

  const counterpartiesHash = taggedHash('COUNTERPARTIES', viewingKey.hash + timeRange)
  const uniqueCounterparties = includeCounterparties
    ? 1 + (parseInt(counterpartiesHash.slice(2, 6), 16) % 20) // 1-20
    : 0

  // Step 3: Generate encrypted tx entries
  const encryptedTransactions: string[] = []
  const txCount = Math.min(totalTransactions, 10) // cap at 10 entries
  for (let i = 0; i < txCount; i++) {
    encryptedTransactions.push(taggedHash('TX_ENTRY', viewingKey.hash + timeRange + i.toString()))
  }

  // Step 4: Encrypt full report
  const reportPayload = `${auditorId}:${timeRange}:${totalTransactions}:${totalVolume}`
  const encryptedReport = taggedHash('REPORT_ENCRYPT', viewingKey.hash + reportPayload)
  const reportHash = taggedHash('REPORT_HASH', encryptedReport)

  // Build report ID
  const reportId = 'rpt_' + bytesToHex(keccak_256(
    new TextEncoder().encode(DOMAIN_TAG + 'REPORT' + reportPayload + Date.now().toString())
  ))

  const now = Date.now()
  const entry: ReportEntry = {
    reportId,
    status: 'encrypted',
    generatedAt: now,
    expiresAt: now + ONE_DAY_MS,
    summary: {
      totalTransactions,
      totalVolume,
      uniqueCounterparties,
      encryptedTransactions,
    },
    encryptedReport,
    reportHash,
  }

  reportCache.set(reportId, entry)
  return entry
}

// ─── Get Report ─────────────────────────────────────────────────────────────

export function getReport(id: string): ReportEntry | null {
  return reportCache.get(id) ?? null
}

// ─── Reset (testing) ────────────────────────────────────────────────────────

export function resetComplianceProvider(): void {
  disclosureCache.clear()
  reportCache.clear()
}
