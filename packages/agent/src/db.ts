import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Schema — embedded to avoid build-path issues with .sql file resolution
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,
  preferences TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  params TEXT NOT NULL,
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'prepared',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS scheduled_ops (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  params TEXT NOT NULL,
  wallet_signature TEXT NOT NULL,
  next_exec INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  max_exec INTEGER NOT NULL,
  exec_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  stealth_address TEXT NOT NULL,
  ephemeral_pubkey TEXT NOT NULL,
  amount REAL,
  token TEXT NOT NULL DEFAULT 'SOL',
  memo TEXT,
  type TEXT NOT NULL DEFAULT 'link',
  invoice_meta TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  paid_tx TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_ops(next_exec, status);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_links(status, expires_at);
`

// ─────────────────────────────────────────────────────────────────────────────
// Singleton connection
// ─────────────────────────────────────────────────────────────────────────────

let db: Database.Database | null = null

/**
 * Get or initialize the SQLite database singleton.
 * DB path resolution: DB_PATH env > /app/data/sipher.db > :memory: (tests)
 */
export function getDb(): Database.Database {
  if (db) return db

  const dbPath = process.env.DB_PATH
    ?? (process.env.NODE_ENV === 'test' ? ':memory:' : '/app/data/sipher.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  return db
}

/** Close the database connection. Safe to call multiple times. */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  wallet: string
  preferences: Record<string, unknown>
  created_at: number
  last_active: number
}

/** SHA-256 hash of the wallet public key — deterministic session ID. */
function walletToSessionId(wallet: string): string {
  return createHash('sha256').update(wallet).digest('hex')
}

/**
 * Get an existing session or create a new one for the given wallet.
 * Updates `last_active` on every call for existing sessions.
 */
export function getOrCreateSession(wallet: string): Session {
  const conn = getDb()
  const id = walletToSessionId(wallet)
  const now = Date.now()

  const existing = conn
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as { id: string; wallet: string; preferences: string; created_at: number; last_active: number } | undefined

  if (existing) {
    conn.prepare('UPDATE sessions SET last_active = ? WHERE id = ?').run(now, id)
    return {
      ...existing,
      last_active: now,
      preferences: JSON.parse(existing.preferences),
    }
  }

  conn.prepare(
    'INSERT INTO sessions (id, wallet, preferences, created_at, last_active) VALUES (?, ?, ?, ?, ?)',
  ).run(id, wallet, '{}', now, now)

  return { id, wallet, preferences: {}, created_at: now, last_active: now }
}

/** Merge new preferences into the existing preferences JSON. */
export function updatePreferences(
  sessionId: string,
  prefs: Record<string, unknown>,
): void {
  const conn = getDb()
  const row = conn
    .prepare('SELECT preferences FROM sessions WHERE id = ?')
    .get(sessionId) as { preferences: string } | undefined

  if (!row) throw new Error(`Session not found: ${sessionId}`)

  const merged = { ...JSON.parse(row.preferences), ...prefs }
  conn
    .prepare('UPDATE sessions SET preferences = ? WHERE id = ?')
    .run(JSON.stringify(merged), sessionId)
}

/** Lookup a session by wallet address. Returns null if not found. */
export function getSessionByWallet(wallet: string): Session | null {
  const conn = getDb()
  const id = walletToSessionId(wallet)
  const row = conn
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as { id: string; wallet: string; preferences: string; created_at: number; last_active: number } | undefined

  if (!row) return null
  return { ...row, preferences: JSON.parse(row.preferences) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number
  session_id: string
  action: string
  params: Record<string, unknown>
  tx_signature: string | null
  status: string
  created_at: number
}

/** Keys that must never be persisted in the audit log. */
const SENSITIVE_KEYS = ['viewingKey', 'spendingKey', 'privateKey']

/** Strip sensitive keys from params before persisting. */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...params }
  for (const key of SENSITIVE_KEYS) {
    delete clean[key]
  }
  return clean
}

/** Insert a new audit log entry. Returns the auto-incremented ID. */
export function logAudit(
  sessionId: string,
  action: string,
  params: Record<string, unknown>,
  status = 'prepared',
  txSignature?: string,
): number {
  const conn = getDb()
  const sanitized = sanitizeParams(params)
  const result = conn.prepare(
    'INSERT INTO audit_log (session_id, action, params, tx_signature, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(sessionId, action, JSON.stringify(sanitized), txSignature ?? null, status, Date.now())

  return Number(result.lastInsertRowid)
}

/** Update the status (and optionally tx_signature) of an audit entry. */
export function updateAuditStatus(
  id: number,
  status: string,
  txSignature?: string,
): void {
  const conn = getDb()
  if (txSignature !== undefined) {
    conn.prepare('UPDATE audit_log SET status = ?, tx_signature = ? WHERE id = ?')
      .run(status, txSignature, id)
  } else {
    conn.prepare('UPDATE audit_log SET status = ? WHERE id = ?')
      .run(status, id)
  }
}

export interface AuditLogOptions {
  action?: string
  limit?: number
}

/** Query audit log entries for a session, newest first. */
export function getAuditLog(
  sessionId: string,
  options: AuditLogOptions = {},
): AuditEntry[] {
  const conn = getDb()
  const limit = options.limit ?? 100

  let sql = 'SELECT * FROM audit_log WHERE session_id = ?'
  const bindings: (string | number)[] = [sessionId]

  if (options.action) {
    sql += ' AND action = ?'
    bindings.push(options.action)
  }

  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?'
  bindings.push(limit)

  const rows = conn.prepare(sql).all(...bindings) as Array<{
    id: number
    session_id: string
    action: string
    params: string
    tx_signature: string | null
    status: string
    created_at: number
  }>

  return rows.map((r) => ({
    ...r,
    params: JSON.parse(r.params),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment links
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentLink {
  id: string
  session_id: string | null
  stealth_address: string
  ephemeral_pubkey: string
  amount: number | null
  token: string
  memo: string | null
  type: string
  invoice_meta: Record<string, unknown> | null
  status: string
  expires_at: number
  paid_tx: string | null
  created_at: number
}

export interface CreatePaymentLinkData {
  id?: string
  session_id?: string | null
  stealth_address: string
  ephemeral_pubkey: string
  amount?: number | null
  token?: string
  memo?: string | null
  type?: string
  invoice_meta?: Record<string, unknown> | null
  expires_at: number
}

/** Create a new payment link. Generates a UUID if id is not provided. */
export function createPaymentLink(data: CreatePaymentLinkData): PaymentLink {
  const conn = getDb()
  const id = data.id ?? randomUUID()
  const now = Date.now()

  conn.prepare(`
    INSERT INTO payment_links
      (id, session_id, stealth_address, ephemeral_pubkey, amount, token, memo, type, invoice_meta, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id,
    data.session_id ?? null,
    data.stealth_address,
    data.ephemeral_pubkey,
    data.amount ?? null,
    data.token ?? 'SOL',
    data.memo ?? null,
    data.type ?? 'link',
    data.invoice_meta ? JSON.stringify(data.invoice_meta) : null,
    data.expires_at,
    now,
  )

  return {
    id,
    session_id: data.session_id ?? null,
    stealth_address: data.stealth_address,
    ephemeral_pubkey: data.ephemeral_pubkey,
    amount: data.amount ?? null,
    token: data.token ?? 'SOL',
    memo: data.memo ?? null,
    type: data.type ?? 'link',
    invoice_meta: data.invoice_meta ?? null,
    status: 'pending',
    expires_at: data.expires_at,
    paid_tx: null,
    created_at: now,
  }
}

/** Retrieve a payment link by ID. Returns null if not found. */
export function getPaymentLink(id: string): PaymentLink | null {
  const conn = getDb()
  const row = conn.prepare('SELECT * FROM payment_links WHERE id = ?').get(id) as {
    id: string
    session_id: string | null
    stealth_address: string
    ephemeral_pubkey: string
    amount: number | null
    token: string
    memo: string | null
    type: string
    invoice_meta: string | null
    status: string
    expires_at: number
    paid_tx: string | null
    created_at: number
  } | undefined

  if (!row) return null
  return {
    ...row,
    invoice_meta: row.invoice_meta ? JSON.parse(row.invoice_meta) : null,
  }
}

/** Mark a payment link as paid with the confirming transaction signature. */
export function markPaymentLinkPaid(id: string, txSignature: string): void {
  const conn = getDb()
  conn.prepare('UPDATE payment_links SET status = ?, paid_tx = ? WHERE id = ?')
    .run('paid', txSignature, id)
}
