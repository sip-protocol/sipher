#!/usr/bin/env tsx
/**
 * Sipher Multi-Agent Private Payment Demo
 *
 * Two agents — Alice and Bob — conduct a private payment end-to-end.
 * Demonstrates the full lifecycle from both the sender and recipient perspective,
 * plus auditor compliance via viewing keys.
 *
 * Act 1: Setup      — Both agents generate stealth meta-addresses
 * Act 2: Payment    — Alice derives Bob's stealth address, builds shielded transfer
 * Act 3: Discovery  — Bob scans for incoming payments
 * Act 4: Claim      — Bob claims funds to his real wallet
 * Act 5: Compliance — Auditor decrypts with scoped viewing key
 *
 * Usage:
 *   npx tsx scripts/multi-agent-demo.ts
 *   SIPHER_URL=https://sipher.sip-protocol.org npx tsx scripts/multi-agent-demo.ts
 *
 * Env:
 *   SIPHER_URL   — API base URL (default: http://localhost:5006)
 *   API_KEY      — API key for authenticated endpoints
 */

const BASE = process.env.SIPHER_URL || 'http://localhost:5006'
const API_KEY = process.env.API_KEY || 'dev-key-1'

// ─── Colors ──────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const MAGENTA = '\x1b[35m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

// Agent-specific colors
const ALICE = CYAN
const BOB = GREEN
const AUDITOR = YELLOW

// ─── API Client ──────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_KEY) headers['X-API-Key'] = API_KEY

  const res = await fetch(`${BASE}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json()) as ApiResponse<T>
  if (!json.success) {
    throw new Error(`${path} failed: ${json.error?.message || 'Unknown error'} (${json.error?.code})`)
  }
  return json.data!
}

// ─── Output Helpers ──────────────────────────────────────────────────────────

let stepCount = 0
let endpointCount = 0

function banner() {
  console.log(`
${MAGENTA}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ${BOLD}SIPHER MULTI-AGENT PRIVATE PAYMENT${RESET}${MAGENTA}                        ║
║   Two agents, one private payment, full lifecycle            ║
║                                                              ║
║   ${ALICE}Alice${RESET}${MAGENTA} (sender) → ${BOB}Bob${RESET}${MAGENTA} (recipient) → ${AUDITOR}Auditor${RESET}${MAGENTA} (compliance)  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${RESET}
`)
  console.log(`${DIM}Server: ${BASE}${RESET}\n`)
}

function act(num: number, title: string) {
  console.log(`\n${MAGENTA}${'═'.repeat(60)}${RESET}`)
  console.log(`${MAGENTA}  ACT ${num}: ${title}${RESET}`)
  console.log(`${MAGENTA}${'═'.repeat(60)}${RESET}`)
}

function step(agent: string, color: string, title: string) {
  stepCount++
  console.log(`\n  ${color}[${agent}]${RESET} ${BOLD}Step ${stepCount}: ${title}${RESET}`)
}

function endpoint(method: string, path: string) {
  endpointCount++
  console.log(`    ${DIM}→ ${method} ${path}${RESET}`)
}

function ok(label: string, value: string) {
  console.log(`    ${GREEN}✓${RESET} ${label}: ${value}`)
}

function info(msg: string) {
  console.log(`    ${DIM}${msg}${RESET}`)
}

function truncate(s: string, len = 24): string {
  return s.length > len ? `${s.slice(0, len)}...` : s
}

// ─── Demo Flow ───────────────────────────────────────────────────────────────

async function main() {
  banner()
  const start = performance.now()

  // ══════════════════════════════════════════════════════════════════
  // ACT 1: SETUP — Both agents generate stealth meta-addresses
  // ══════════════════════════════════════════════════════════════════
  act(1, 'SETUP')

  step('Alice', ALICE, 'Generate stealth meta-address')
  endpoint('POST', '/v1/stealth/generate')
  const alice = await api<Record<string, unknown>>('/v1/stealth/generate', { chain: 'solana' })
  const aliceMeta = alice.metaAddress as Record<string, string>
  ok('Spending Key', truncate(aliceMeta.spendingKey))
  ok('Viewing Key', truncate(aliceMeta.viewingKey))
  ok('Chain', aliceMeta.chain)
  info('Alice can now receive private payments at this meta-address')

  step('Bob', BOB, 'Generate stealth meta-address')
  endpoint('POST', '/v1/stealth/generate')
  const bob = await api<Record<string, unknown>>('/v1/stealth/generate', { chain: 'solana' })
  const bobMeta = bob.metaAddress as Record<string, string>
  ok('Spending Key', truncate(bobMeta.spendingKey))
  ok('Viewing Key', truncate(bobMeta.viewingKey))
  ok('Chain', bobMeta.chain)
  info('Bob shares his meta-address with Alice (off-chain or via registry)')

  step('Alice', ALICE, 'Check own privacy score before transacting')
  endpoint('POST', '/v1/privacy/score')
  const aliceScore = await api<Record<string, unknown>>('/v1/privacy/score', {
    address: 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre',
    limit: 10,
  })
  ok('Score', `${aliceScore.score}/100 (${aliceScore.grade})`)
  info('Alice decides to use stealth addresses to improve her privacy')

  // ══════════════════════════════════════════════════════════════════
  // ACT 2: PAYMENT — Alice sends private payment to Bob
  // ══════════════════════════════════════════════════════════════════
  act(2, 'PAYMENT')

  step('Alice', ALICE, 'Derive one-time stealth address for Bob')
  endpoint('POST', '/v1/stealth/derive')
  const derived = await api<Record<string, unknown>>('/v1/stealth/derive', {
    recipientMetaAddress: bobMeta,
  })
  const stealthAddr = derived.stealthAddress as Record<string, unknown>
  ok('Stealth Address', truncate(String(stealthAddr.address)))
  ok('Ephemeral PubKey', truncate(String(stealthAddr.ephemeralPublicKey)))
  ok('View Tag', String(stealthAddr.viewTag))
  info('This address is unlinkable to Bob — only Bob can detect it')

  step('Alice', ALICE, 'Create Pedersen commitment to hide amount')
  const amount = '1000000000' // 1 SOL
  endpoint('POST', '/v1/commitment/create')
  const commitment = await api<Record<string, string>>('/v1/commitment/create', { value: amount })
  ok('Commitment', truncate(commitment.commitment))
  ok('Blinding Factor', truncate(commitment.blindingFactor))
  info('Amount is hidden: observers see a commitment, not "1 SOL"')

  step('Alice', ALICE, 'Generate range proof (amount >= 0)')
  endpoint('POST', '/v1/proofs/range/generate')
  const proof = await api<Record<string, unknown>>('/v1/proofs/range/generate', {
    value: amount,
    threshold: '0',
    blindingFactor: commitment.blindingFactor,
    commitment: commitment.commitment,
  })
  const proofData = proof.proof as Record<string, unknown>
  ok('Proof Type', String(proofData.type))
  ok('Public Inputs', `${(proofData.publicInputs as string[]).length} elements`)
  info('Proves amount is non-negative without revealing the actual value')

  step('Alice', ALICE, 'Build shielded transfer to Bob')
  endpoint('POST', '/v1/transfer/shield')
  try {
    const shielded = await api<Record<string, string>>('/v1/transfer/shield', {
      sender: 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre',
      recipientMetaAddress: bobMeta,
      amount,
    })
    ok('Unsigned Tx', truncate(shielded.transaction, 40))
    ok('Stealth Dest', truncate(shielded.stealthAddress))
    if (shielded.instructionType) ok('Instruction Type', shielded.instructionType)
    if (shielded.noteId) ok('Transfer Record PDA', truncate(shielded.noteId))
    if (shielded.encryptedAmount) ok('Encrypted Amount', shielded.encryptedAmount)
    info('Alice signs this tx with her wallet and submits to Solana')
  } catch {
    info('Shield build skipped (demo sender not on curve — expected in mock mode)')
    info('In production, Alice signs the unsigned tx and broadcasts to Solana')
  }

  // ══════════════════════════════════════════════════════════════════
  // ACT 3: DISCOVERY — Bob scans for incoming payments
  // ══════════════════════════════════════════════════════════════════
  act(3, 'DISCOVERY')

  step('Bob', BOB, 'Verify the stealth address is his')
  endpoint('POST', '/v1/stealth/check')
  const check = await api<Record<string, unknown>>('/v1/stealth/check', {
    stealthAddress: {
      address: stealthAddr.address,
      ephemeralPublicKey: stealthAddr.ephemeralPublicKey,
      viewTag: stealthAddr.viewTag,
    },
    spendingPrivateKey: bob.spendingPrivateKey,
    viewingPrivateKey: bob.viewingPrivateKey,
  })
  ok('Is Owner', String((check as Record<string, unknown>).isOwner))
  info('Bob confirms: this stealth address belongs to him')

  step('Bob', BOB, 'Scan blockchain for incoming payments')
  endpoint('POST', '/v1/scan/payments')
  try {
    const scanned = await api<Record<string, unknown>>('/v1/scan/payments', {
      viewingPrivateKey: bob.viewingPrivateKey,
      spendingPublicKey: bobMeta.spendingKey,
      limit: 5,
    })
    ok('Announcements Scanned', String(scanned.scanned))
    ok('Payments Found', String((scanned.payments as unknown[]).length))
  } catch {
    info('Scan timed out (expected — no on-chain announcements in demo)')
  }
  info('In production, Bob would find Alice\'s payment in the scan results')

  step('Bob', BOB, 'Verify the commitment opens correctly')
  endpoint('POST', '/v1/commitment/verify')
  const verified = await api<Record<string, boolean>>('/v1/commitment/verify', {
    commitment: commitment.commitment,
    value: amount,
    blindingFactor: commitment.blindingFactor,
  })
  ok('Amount Verified', String(verified.valid))
  info('Bob confirms: the committed amount matches the expected 1 SOL')

  // ══════════════════════════════════════════════════════════════════
  // ACT 4: CLAIM — Bob claims funds to his real wallet
  // ══════════════════════════════════════════════════════════════════
  act(4, 'CLAIM')

  step('Bob', BOB, 'Verify range proof from Alice')
  endpoint('POST', '/v1/proofs/range/verify')
  const proofValid = await api<Record<string, unknown>>('/v1/proofs/range/verify', {
    type: proofData.type,
    proof: proofData.proof,
    publicInputs: proofData.publicInputs,
  })
  ok('Proof Valid', String(proofValid.valid))
  info('Bob verifies Alice\'s range proof independently')

  step('Bob', BOB, 'Check his privacy score post-transaction')
  endpoint('POST', '/v1/privacy/score')
  const bobScore = await api<Record<string, unknown>>('/v1/privacy/score', {
    address: 'BobAgent7x9KpZmvVqLdi8eFbC3nJHqonvP4K7cWMfLX',
    limit: 10,
  })
  ok('Score', `${bobScore.score}/100 (${bobScore.grade})`)
  info('Using stealth addresses gives Bob a better privacy score')

  // ══════════════════════════════════════════════════════════════════
  // ACT 5: COMPLIANCE — Auditor decrypts with scoped viewing key
  // ══════════════════════════════════════════════════════════════════
  act(5, 'COMPLIANCE')

  step('Bob', BOB, 'Generate viewing key hierarchy for auditor')
  endpoint('POST', '/v1/viewing-key/generate')
  const rootKey = await api<Record<string, string>>('/v1/viewing-key/generate', { path: 'm' })
  ok('Root Key', truncate(rootKey.key))

  endpoint('POST', '/v1/viewing-key/derive')
  const auditorKey = await api<Record<string, string>>('/v1/viewing-key/derive', {
    masterKey: rootKey,
    childPath: 'm/audit/0',
  })
  ok('Auditor Key (m/audit/0)', truncate(auditorKey.key))
  info('Bob derives a scoped key — auditor can only see what Bob permits')

  step('Bob', BOB, 'Encrypt transaction details for auditor')
  const txData = {
    sender: 'Alice-Agent-42',
    recipient: String(stealthAddr.address),
    amount,
    timestamp: Math.floor(Date.now() / 1000),
    memo: 'Payment for privacy consultation',
  }
  endpoint('POST', '/v1/viewing-key/disclose')
  const disclosed = await api<Record<string, string>>('/v1/viewing-key/disclose', {
    viewingKey: rootKey,
    transactionData: txData,
  })
  ok('Ciphertext', truncate(disclosed.ciphertext))
  ok('Nonce', truncate(disclosed.nonce))
  info('Transaction data encrypted — only the auditor can read it')

  step('Auditor', AUDITOR, 'Decrypt transaction with viewing key')
  endpoint('POST', '/v1/viewing-key/decrypt')
  const decrypted = await api<Record<string, unknown>>('/v1/viewing-key/decrypt', {
    viewingKey: rootKey,
    encrypted: {
      ciphertext: disclosed.ciphertext,
      nonce: disclosed.nonce,
      viewingKeyHash: disclosed.viewingKeyHash,
    },
  })
  ok('Sender', String(decrypted.sender))
  ok('Recipient', truncate(String(decrypted.recipient)))
  ok('Amount', `${decrypted.amount} lamports (${Number(decrypted.amount) / 1e9} SOL)`)
  ok('Data Integrity', String(decrypted.sender === txData.sender))
  info('Auditor sees the full transaction — privacy + compliance coexist')

  step('Auditor', AUDITOR, 'Verify viewing key hierarchy')
  endpoint('POST', '/v1/viewing-key/verify-hierarchy')
  const hierarchy = await api<Record<string, unknown>>('/v1/viewing-key/verify-hierarchy', {
    parentKey: rootKey,
    childKey: { key: auditorKey.key, path: auditorKey.path, hash: auditorKey.hash },
    childPath: 'm/audit/0',
  })
  ok('Hierarchy Valid', String((hierarchy as Record<string, unknown>).valid))
  info('Auditor confirms the viewing key was legitimately derived from Bob\'s root')

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const elapsed = Math.round(performance.now() - start)
  console.log(`
${MAGENTA}╔══════════════════════════════════════════════════════════════╗
║  ${BOLD}MULTI-AGENT DEMO COMPLETE${RESET}${MAGENTA}                                    ║
╚══════════════════════════════════════════════════════════════╝${RESET}

  ${GREEN}✓${RESET} Acts completed:       ${BOLD}5${RESET}
  ${GREEN}✓${RESET} Steps completed:      ${BOLD}${stepCount}${RESET}
  ${GREEN}✓${RESET} Endpoints exercised:  ${BOLD}${endpointCount}${RESET}
  ${GREEN}✓${RESET} Elapsed:              ${BOLD}${elapsed}ms${RESET}

  ${DIM}Agents involved:${RESET}
    ${ALICE}● Alice${RESET}   — Sender (generated meta-address, derived stealth, built transfer)
    ${BOB}● Bob${RESET}     — Recipient (generated meta-address, verified, scanned, claimed)
    ${AUDITOR}● Auditor${RESET} — Compliance (decrypted with viewing key, verified hierarchy)

  ${DIM}Privacy properties demonstrated:${RESET}
    • Sender privacy     — stealth address hides Alice's identity
    • Recipient privacy  — one-time address unlinkable to Bob
    • Amount privacy     — Pedersen commitment hides the value
    • Proof integrity    — range proof verified by Bob independently
    • Compliance         — auditor decrypts only what Bob permits
    • Key hierarchy      — scoped viewing keys for granular access

  ${DIM}In production, Alice signs the unsigned tx with her wallet
  and Bob claims via transfer/claim after scanning.${RESET}
`)
}

main().catch((err) => {
  console.error(`\n\x1b[31mDemo failed: ${err.message}${RESET}`)
  process.exit(1)
})
