import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  getDb,
  closeDb,
  getOrCreateSession,
  updatePreferences,
  getSessionByWallet,
  logAudit,
  updateAuditStatus,
  getAuditLog,
  createPaymentLink,
  getPaymentLink,
  markPaymentLinkPaid,
  getPaymentLinksBySession,
  expireStaleLinks,
  getPaymentLinkStats,
  getAuditStats,
  getSessionStats,
} from '../src/db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Use in-memory SQLite for all tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

// ─────────────────────────────────────────────────────────────────────────────
// Database initialization
// ─────────────────────────────────────────────────────────────────────────────

describe('getDb', () => {
  it('returns a working database instance', () => {
    const db = getDb()
    expect(db).toBeDefined()
    const result = db.pragma('journal_mode', { simple: true }) as string
    // :memory: databases report "memory" for WAL pragma
    expect(result).toBe('memory')
  })

  it('returns the same instance on subsequent calls', () => {
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })

  it('enforces foreign keys', () => {
    const db = getDb()
    const fk = db.pragma('foreign_keys', { simple: true })
    expect(fk).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

const WALLET_A = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const WALLET_B = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

describe('sessions', () => {
  it('creates a session for a new wallet', () => {
    const session = getOrCreateSession(WALLET_A)
    expect(session.id).toBe(sha256(WALLET_A))
    expect(session.id).toHaveLength(64)
    expect(session.wallet).toBe(WALLET_A)
    expect(session.preferences).toEqual({})
    expect(session.created_at).toBeGreaterThan(0)
    expect(session.last_active).toBeGreaterThanOrEqual(session.created_at)
  })

  it('returns the same session for the same wallet', () => {
    const s1 = getOrCreateSession(WALLET_A)
    const s2 = getOrCreateSession(WALLET_A)
    expect(s1.id).toBe(s2.id)
    expect(s1.wallet).toBe(s2.wallet)
    expect(s2.last_active).toBeGreaterThanOrEqual(s1.last_active)
  })

  it('creates different sessions for different wallets', () => {
    const sa = getOrCreateSession(WALLET_A)
    const sb = getOrCreateSession(WALLET_B)
    expect(sa.id).not.toBe(sb.id)
    expect(sa.wallet).not.toBe(sb.wallet)
  })

  it('stores and retrieves preferences', () => {
    const session = getOrCreateSession(WALLET_A)
    updatePreferences(session.id, { theme: 'dark', slippage: 0.5 })

    const retrieved = getSessionByWallet(WALLET_A)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.preferences).toEqual({ theme: 'dark', slippage: 0.5 })
  })

  it('merges preferences on update', () => {
    const session = getOrCreateSession(WALLET_A)
    updatePreferences(session.id, { theme: 'dark' })
    updatePreferences(session.id, { slippage: 0.5 })

    const retrieved = getSessionByWallet(WALLET_A)
    expect(retrieved!.preferences).toEqual({ theme: 'dark', slippage: 0.5 })
  })

  it('throws when updating preferences for non-existent session', () => {
    expect(() => updatePreferences('nonexistent', { x: 1 }))
      .toThrow('Session not found: nonexistent')
  })

  it('returns null for unknown wallet', () => {
    const result = getSessionByWallet('unknown')
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

describe('audit log', () => {
  it('logs an entry with auto-increment ID', () => {
    const session = getOrCreateSession(WALLET_A)
    const id1 = logAudit(session.id, 'send', { to: 'addr', amount: 1.5 })
    const id2 = logAudit(session.id, 'deposit', { amount: 2.0 })

    expect(typeof id1).toBe('number')
    expect(id2).toBe(id1 + 1)
  })

  it('retrieves log sorted by created_at DESC', () => {
    const session = getOrCreateSession(WALLET_A)
    logAudit(session.id, 'send', { to: 'addr1' })
    logAudit(session.id, 'deposit', { amount: 5 })
    logAudit(session.id, 'swap', { from: 'SOL', to: 'USDC' })

    const log = getAuditLog(session.id)
    expect(log).toHaveLength(3)
    // Most recent first
    expect(log[0].action).toBe('swap')
    expect(log[2].action).toBe('send')
    // Timestamps are descending
    for (let i = 0; i < log.length - 1; i++) {
      expect(log[i].created_at).toBeGreaterThanOrEqual(log[i + 1].created_at)
    }
  })

  it('filters by action', () => {
    const session = getOrCreateSession(WALLET_A)
    logAudit(session.id, 'send', { to: 'addr1' })
    logAudit(session.id, 'deposit', { amount: 5 })
    logAudit(session.id, 'send', { to: 'addr2' })

    const sends = getAuditLog(session.id, { action: 'send' })
    expect(sends).toHaveLength(2)
    expect(sends.every((e) => e.action === 'send')).toBe(true)
  })

  it('respects limit option', () => {
    const session = getOrCreateSession(WALLET_A)
    for (let i = 0; i < 10; i++) {
      logAudit(session.id, 'send', { i })
    }

    const limited = getAuditLog(session.id, { limit: 3 })
    expect(limited).toHaveLength(3)
  })

  it('sanitizes sensitive params', () => {
    const session = getOrCreateSession(WALLET_A)
    logAudit(session.id, 'send', {
      to: 'addr',
      amount: 1,
      viewingKey: 'secret-viewing-key',
      spendingKey: 'secret-spending-key',
      privateKey: 'secret-private-key',
    })

    const log = getAuditLog(session.id)
    expect(log).toHaveLength(1)
    expect(log[0].params).toEqual({ to: 'addr', amount: 1 })
    expect(log[0].params).not.toHaveProperty('viewingKey')
    expect(log[0].params).not.toHaveProperty('spendingKey')
    expect(log[0].params).not.toHaveProperty('privateKey')
  })

  it('stores and updates status and tx_signature', () => {
    const session = getOrCreateSession(WALLET_A)
    const id = logAudit(session.id, 'send', { to: 'addr' })

    const before = getAuditLog(session.id)
    expect(before[0].status).toBe('prepared')
    expect(before[0].tx_signature).toBeNull()

    updateAuditStatus(id, 'confirmed', '5abc...tx')

    const after = getAuditLog(session.id)
    expect(after[0].status).toBe('confirmed')
    expect(after[0].tx_signature).toBe('5abc...tx')
  })

  it('updates status without tx_signature', () => {
    const session = getOrCreateSession(WALLET_A)
    const id = logAudit(session.id, 'send', { to: 'addr' })
    updateAuditStatus(id, 'failed')

    const log = getAuditLog(session.id)
    expect(log[0].status).toBe('failed')
    expect(log[0].tx_signature).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Payment links
// ─────────────────────────────────────────────────────────────────────────────

describe('payment links', () => {
  it('creates and retrieves a link', () => {
    const link = createPaymentLink({
      stealth_address: '0xstealth123',
      ephemeral_pubkey: '0xeph456',
      amount: 1.5,
      token: 'SOL',
      memo: 'Coffee payment',
      expires_at: Date.now() + 3600_000,
    })

    expect(link.id).toBeDefined()
    expect(link.status).toBe('pending')
    expect(link.paid_tx).toBeNull()
    expect(link.stealth_address).toBe('0xstealth123')
    expect(link.ephemeral_pubkey).toBe('0xeph456')
    expect(link.amount).toBe(1.5)
    expect(link.token).toBe('SOL')
    expect(link.memo).toBe('Coffee payment')

    const retrieved = getPaymentLink(link.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(link.id)
    expect(retrieved!.stealth_address).toBe('0xstealth123')
    expect(retrieved!.amount).toBe(1.5)
  })

  it('uses custom id when provided', () => {
    const link = createPaymentLink({
      id: 'custom-link-id',
      stealth_address: '0xstealth',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })

    expect(link.id).toBe('custom-link-id')
    const retrieved = getPaymentLink('custom-link-id')
    expect(retrieved).not.toBeNull()
  })

  it('stores invoice metadata', () => {
    const meta = { items: ['widget'], total: 42.0 }
    const link = createPaymentLink({
      stealth_address: '0xstealth',
      ephemeral_pubkey: '0xeph',
      type: 'invoice',
      invoice_meta: meta,
      expires_at: Date.now() + 3600_000,
    })

    const retrieved = getPaymentLink(link.id)
    expect(retrieved!.type).toBe('invoice')
    expect(retrieved!.invoice_meta).toEqual(meta)
  })

  it('marks link as paid with TX signature', () => {
    const link = createPaymentLink({
      stealth_address: '0xstealth',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })

    expect(link.status).toBe('pending')
    markPaymentLinkPaid(link.id, '3QCoHcJ...1NNg')

    const paid = getPaymentLink(link.id)
    expect(paid!.status).toBe('paid')
    expect(paid!.paid_tx).toBe('3QCoHcJ...1NNg')
  })

  it('returns null for non-existent link', () => {
    const result = getPaymentLink('does-not-exist')
    expect(result).toBeNull()
  })

  it('defaults token to SOL and type to link', () => {
    const link = createPaymentLink({
      stealth_address: '0xstealth',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })

    expect(link.token).toBe('SOL')
    expect(link.type).toBe('link')
  })

  it('associates link with a session', () => {
    const session = getOrCreateSession(WALLET_A)
    const link = createPaymentLink({
      session_id: session.id,
      stealth_address: '0xstealth',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })

    const retrieved = getPaymentLink(link.id)
    expect(retrieved!.session_id).toBe(session.id)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getPaymentLinksBySession
// ─────────────────────────────────────────────────────────────────────────────

describe('getPaymentLinksBySession', () => {
  it('returns links for a session sorted by created_at DESC', () => {
    const session = getOrCreateSession(WALLET_A)
    createPaymentLink({
      session_id: session.id,
      stealth_address: '0xfirst',
      ephemeral_pubkey: '0xeph1',
      expires_at: Date.now() + 3600_000,
    })
    createPaymentLink({
      session_id: session.id,
      stealth_address: '0xsecond',
      ephemeral_pubkey: '0xeph2',
      expires_at: Date.now() + 3600_000,
    })
    const links = getPaymentLinksBySession(session.id)
    expect(links).toHaveLength(2)
    expect(links[0].stealth_address).toBe('0xsecond')
    expect(links[1].stealth_address).toBe('0xfirst')
  })

  it('returns empty array for unknown session', () => {
    const links = getPaymentLinksBySession('nonexistent')
    expect(links).toHaveLength(0)
  })

  it('respects limit', () => {
    const session = getOrCreateSession(WALLET_A)
    for (let i = 0; i < 5; i++) {
      createPaymentLink({
        session_id: session.id,
        stealth_address: `0xaddr${i}`,
        ephemeral_pubkey: `0xeph${i}`,
        expires_at: Date.now() + 3600_000,
      })
    }
    const links = getPaymentLinksBySession(session.id, 2)
    expect(links).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// expireStaleLinks
// ─────────────────────────────────────────────────────────────────────────────

describe('expireStaleLinks', () => {
  it('marks expired pending links as expired', () => {
    createPaymentLink({
      stealth_address: '0xexpired',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000,
    })
    createPaymentLink({
      stealth_address: '0xactive',
      ephemeral_pubkey: '0xeph2',
      expires_at: Date.now() + 3600_000,
    })
    const count = expireStaleLinks()
    expect(count).toBe(1)
    const db = getDb()
    const expired = db.prepare("SELECT * FROM payment_links WHERE stealth_address = '0xexpired'").get() as { status: string }
    expect(expired.status).toBe('expired')
    const active = db.prepare("SELECT * FROM payment_links WHERE stealth_address = '0xactive'").get() as { status: string }
    expect(active.status).toBe('pending')
  })

  it('does not expire already-paid links', () => {
    const link = createPaymentLink({
      stealth_address: '0xpaid',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000,
    })
    markPaymentLinkPaid(link.id, 'some-tx')
    const count = expireStaleLinks()
    expect(count).toBe(0)
    const retrieved = getPaymentLink(link.id)
    expect(retrieved!.status).toBe('paid')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getPaymentLinkStats
// ─────────────────────────────────────────────────────────────────────────────

describe('getPaymentLinkStats', () => {
  it('returns counts by status', () => {
    createPaymentLink({ stealth_address: '0xa', ephemeral_pubkey: '0xe1', expires_at: Date.now() + 3600_000 })
    createPaymentLink({ stealth_address: '0xb', ephemeral_pubkey: '0xe2', expires_at: Date.now() + 3600_000 })
    const link3 = createPaymentLink({ stealth_address: '0xc', ephemeral_pubkey: '0xe3', expires_at: Date.now() + 3600_000 })
    markPaymentLinkPaid(link3.id, 'tx123')
    const stats = getPaymentLinkStats()
    expect(stats.pending).toBe(2)
    expect(stats.paid).toBe(1)
    expect(stats.total).toBe(3)
  })

  it('returns zeros when no links exist', () => {
    const stats = getPaymentLinkStats()
    expect(stats.total).toBe(0)
    expect(stats.pending).toBe(0)
    expect(stats.paid).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getAuditStats
// ─────────────────────────────────────────────────────────────────────────────

describe('getAuditStats', () => {
  it('returns action counts within time window', () => {
    const session = getOrCreateSession(WALLET_A)
    logAudit(session.id, 'send', { to: 'addr' })
    logAudit(session.id, 'send', { to: 'addr2' })
    logAudit(session.id, 'deposit', { amount: 5 })
    logAudit(session.id, 'swap', { from: 'SOL', to: 'USDC' })
    const stats = getAuditStats(24 * 60 * 60 * 1000)
    expect(stats.total).toBe(4)
    expect(stats.byAction.send).toBe(2)
    expect(stats.byAction.deposit).toBe(1)
    expect(stats.byAction.swap).toBe(1)
  })

  it('returns zeros for empty log', () => {
    const stats = getAuditStats(24 * 60 * 60 * 1000)
    expect(stats.total).toBe(0)
    expect(stats.byAction).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getSessionStats
// ─────────────────────────────────────────────────────────────────────────────

describe('getSessionStats', () => {
  it('returns session counts', () => {
    getOrCreateSession(WALLET_A)
    getOrCreateSession(WALLET_B)
    const stats = getSessionStats()
    expect(stats.total).toBe(2)
  })

  it('returns zero when no sessions', () => {
    const stats = getSessionStats()
    expect(stats.total).toBe(0)
  })
})
