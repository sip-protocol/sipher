import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { ulid } from 'ulid'

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

CREATE TABLE IF NOT EXISTS activity_stream (
  id          TEXT PRIMARY KEY,
  agent       TEXT NOT NULL,
  level       TEXT NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  detail      TEXT,
  wallet      TEXT,
  actionable  INTEGER DEFAULT 0,
  action_type TEXT,
  action_data TEXT,
  dismissed   INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS herald_queue (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  content      TEXT NOT NULL,
  reply_to     TEXT,
  scheduled_at TEXT,
  status       TEXT DEFAULT 'pending',
  approved_by  TEXT,
  approved_at  TEXT,
  posted_at    TEXT,
  tweet_id     TEXT,
  metrics      TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS herald_dms (
  id          TEXT PRIMARY KEY,
  x_user_id   TEXT NOT NULL,
  x_username  TEXT NOT NULL,
  intent      TEXT NOT NULL,
  message     TEXT NOT NULL,
  response    TEXT,
  tool_used   TEXT,
  exec_link   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_links (
  id          TEXT PRIMARY KEY,
  wallet      TEXT,
  action      TEXT NOT NULL,
  params      TEXT NOT NULL,
  source      TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',
  expires_at  TEXT NOT NULL,
  signed_tx   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_log (
  id          TEXT PRIMARY KEY,
  agent       TEXT NOT NULL,
  provider    TEXT NOT NULL,
  operation   TEXT NOT NULL,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  resources   INTEGER,
  cost_usd    REAL NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
  id          TEXT PRIMARY KEY,
  from_agent  TEXT NOT NULL,
  to_agent    TEXT,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  session_id  TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (session_id, seq),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_activity_wallet_created ON activity_stream(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_level ON activity_stream(level);
CREATE INDEX IF NOT EXISTS idx_herald_queue_status ON herald_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_herald_dms_user ON herald_dms(x_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_links_status ON execution_links(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_cost_log_agent_date ON cost_log(agent, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_created ON agent_events(created_at DESC);

CREATE TABLE IF NOT EXISTS sentinel_blacklist (
  id              TEXT PRIMARY KEY,
  address         TEXT NOT NULL,
  reason          TEXT NOT NULL,
  severity        TEXT NOT NULL,
  added_by        TEXT NOT NULL,
  added_at        TEXT NOT NULL,
  expires_at      TEXT,
  removed_at      TEXT,
  removed_by      TEXT,
  removed_reason  TEXT,
  source_event_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_blacklist_active
  ON sentinel_blacklist(address) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS sentinel_risk_history (
  id              TEXT PRIMARY KEY,
  address         TEXT NOT NULL,
  context_action  TEXT,
  wallet          TEXT,
  risk            TEXT NOT NULL,
  score           INTEGER NOT NULL,
  reasons         TEXT NOT NULL,
  recommendation  TEXT NOT NULL,
  decision_id     TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_history
  ON sentinel_risk_history(address, created_at DESC);

CREATE TABLE IF NOT EXISTS sentinel_pending_actions (
  id             TEXT PRIMARY KEY,
  action_type    TEXT NOT NULL,
  payload        TEXT NOT NULL,
  reasoning      TEXT NOT NULL,
  wallet         TEXT,
  scheduled_at   TEXT NOT NULL,
  execute_at     TEXT NOT NULL,
  status         TEXT NOT NULL,
  executed_at    TEXT,
  cancelled_at   TEXT,
  cancelled_by   TEXT,
  cancel_reason  TEXT,
  result         TEXT,
  decision_id    TEXT
);
CREATE INDEX IF NOT EXISTS idx_pending_due
  ON sentinel_pending_actions(execute_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS sentinel_decisions (
  id                TEXT PRIMARY KEY,
  invocation_source TEXT NOT NULL,
  trigger_event_id  TEXT,
  trigger_context   TEXT,
  model             TEXT NOT NULL,
  duration_ms       INTEGER NOT NULL,
  tool_calls        TEXT NOT NULL,
  reasoning         TEXT,
  verdict           TEXT NOT NULL,
  verdict_detail    TEXT,
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cost_usd          REAL,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_trigger
  ON sentinel_decisions(trigger_event_id);
CREATE INDEX IF NOT EXISTS idx_decisions_source
  ON sentinel_decisions(invocation_source, created_at DESC);
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
// Conversations (persisted to SQLite)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationRow {
  session_id: string
  seq: number
  role: string
  content: string
  created_at: number
}

/** Load all conversation messages for a session, ordered by seq. */
export function loadConversation(sessionId: string): ConversationRow[] {
  const conn = getDb()
  return conn
    .prepare('SELECT * FROM conversations WHERE session_id = ? ORDER BY seq ASC')
    .all(sessionId) as ConversationRow[]
}

/** Append messages to a session's conversation. Returns the new seq values. */
export function appendConversationRows(
  sessionId: string,
  messages: { role: string; content: unknown }[],
  maxMessages = 100,
): void {
  const conn = getDb()
  const now = Date.now()

  // Get current max seq
  const maxRow = conn
    .prepare('SELECT COALESCE(MAX(seq), 0) AS max_seq FROM conversations WHERE session_id = ?')
    .get(sessionId) as { max_seq: number }
  let seq = maxRow.max_seq

  const insert = conn.prepare(
    'INSERT INTO conversations (session_id, seq, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
  )

  const tx = conn.transaction(() => {
    for (const msg of messages) {
      seq++
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      insert.run(sessionId, seq, msg.role, content, now)
    }

    // Trim to maxMessages — keep latest
    const total = (conn
      .prepare('SELECT COUNT(*) AS cnt FROM conversations WHERE session_id = ?')
      .get(sessionId) as { cnt: number }).cnt

    if (total > maxMessages) {
      const cutoff = total - maxMessages
      conn.prepare(
        `DELETE FROM conversations WHERE session_id = ? AND seq IN (
          SELECT seq FROM conversations WHERE session_id = ? ORDER BY seq ASC LIMIT ?
        )`,
      ).run(sessionId, sessionId, cutoff)
    }
  })

  tx()
}

/** Delete all conversation messages for a session. */
export function clearConversationRows(sessionId: string): void {
  const conn = getDb()
  conn.prepare('DELETE FROM conversations WHERE session_id = ?').run(sessionId)
}

/** Delete conversations idle longer than the given timeout (ms). Returns purged count. */
export function purgeStaleConversations(timeoutMs: number): number {
  const conn = getDb()
  const cutoff = Date.now() - timeoutMs
  const result = conn.prepare(
    'DELETE FROM conversations WHERE session_id IN (SELECT DISTINCT session_id FROM conversations GROUP BY session_id HAVING MAX(created_at) < ?)',
  ).run(cutoff)
  return result.changes
}

/** Count distinct sessions with active conversations. */
export function activeConversationCount(): number {
  const conn = getDb()
  const row = conn.prepare('SELECT COUNT(DISTINCT session_id) AS cnt FROM conversations').get() as { cnt: number }
  return row.cnt
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

/** List payment links for a session, newest first. Default limit: 50. */
export function getPaymentLinksBySession(sessionId: string, limit = 50): PaymentLink[] {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT * FROM payment_links WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
  ).all(sessionId, limit) as Array<{
    id: string; session_id: string | null; stealth_address: string
    ephemeral_pubkey: string; amount: number | null; token: string
    memo: string | null; type: string; invoice_meta: string | null
    status: string; expires_at: number; paid_tx: string | null; created_at: number
  }>
  return rows.map((r) => ({
    ...r,
    invoice_meta: r.invoice_meta ? JSON.parse(r.invoice_meta) : null,
  }))
}

/** Expire all pending links whose expires_at is in the past. Returns count changed. */
export function expireStaleLinks(): number {
  const conn = getDb()
  const result = conn.prepare(
    "UPDATE payment_links SET status = 'expired' WHERE status = 'pending' AND expires_at < ?",
  ).run(Date.now())
  return result.changes
}

export interface PaymentLinkStatsResult {
  total: number
  pending: number
  paid: number
  expired: number
  cancelled: number
}

/** Count payment links grouped by status. */
export function getPaymentLinkStats(): PaymentLinkStatsResult {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT status, COUNT(*) as count FROM payment_links GROUP BY status',
  ).all() as Array<{ status: string; count: number }>
  const stats: PaymentLinkStatsResult = { total: 0, pending: 0, paid: 0, expired: 0, cancelled: 0 }
  for (const row of rows) {
    stats.total += row.count
    if (row.status in stats) {
      (stats as unknown as Record<string, number>)[row.status] = row.count
    }
  }
  return stats
}

export interface AuditStatsResult {
  total: number
  byAction: Record<string, number>
}

/** Count audit log entries by action within a time window (milliseconds from now). */
export function getAuditStats(windowMs: number): AuditStatsResult {
  const conn = getDb()
  const since = Date.now() - windowMs
  const rows = conn.prepare(
    'SELECT action, COUNT(*) as count FROM audit_log WHERE created_at >= ? GROUP BY action',
  ).all(since) as Array<{ action: string; count: number }>
  const byAction: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    byAction[row.action] = row.count
    total += row.count
  }
  return { total, byAction }
}

export interface SessionStatsResult {
  total: number
}

/** Return total session count. */
export function getSessionStats(): SessionStatsResult {
  const conn = getDb()
  const row = conn.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }
  return { total: row.count }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled operations
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduledOp {
  id: string
  session_id: string
  action: string
  params: Record<string, unknown>
  wallet_signature: string
  next_exec: number
  expires_at: number
  max_exec: number
  exec_count: number
  status: string
  created_at: number
}

export interface CreateScheduledOpData {
  id?: string
  session_id: string
  action: string
  params: Record<string, unknown>
  wallet_signature: string
  next_exec: number
  expires_at: number
  max_exec: number
}

type ScheduledOpRow = {
  id: string; session_id: string; action: string; params: string
  wallet_signature: string; next_exec: number; expires_at: number
  max_exec: number; exec_count: number; status: string; created_at: number
}

function parseOpRow(row: ScheduledOpRow): ScheduledOp {
  return { ...row, params: JSON.parse(row.params) }
}

export function createScheduledOp(data: CreateScheduledOpData): ScheduledOp {
  const conn = getDb()
  const id = data.id ?? randomUUID()
  const now = Date.now()
  conn.prepare(`
    INSERT INTO scheduled_ops
      (id, session_id, action, params, wallet_signature, next_exec, expires_at, max_exec, exec_count, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?)
  `).run(id, data.session_id, data.action, JSON.stringify(data.params), data.wallet_signature, data.next_exec, data.expires_at, data.max_exec, now)
  return {
    id, session_id: data.session_id, action: data.action, params: data.params,
    wallet_signature: data.wallet_signature, next_exec: data.next_exec,
    expires_at: data.expires_at, max_exec: data.max_exec, exec_count: 0,
    status: 'pending', created_at: now,
  }
}

export function getScheduledOp(id: string): ScheduledOp | null {
  const conn = getDb()
  const row = conn.prepare('SELECT * FROM scheduled_ops WHERE id = ?').get(id) as ScheduledOpRow | undefined
  return row ? parseOpRow(row) : null
}

export function getScheduledOpsBySession(sessionId: string, limit = 50): ScheduledOp[] {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT * FROM scheduled_ops WHERE session_id = ? ORDER BY next_exec ASC LIMIT ?',
  ).all(sessionId, limit) as ScheduledOpRow[]
  return rows.map(parseOpRow)
}

export function getPendingOps(now?: number): ScheduledOp[] {
  const conn = getDb()
  const ts = now ?? Date.now()
  const rows = conn.prepare(
    "SELECT * FROM scheduled_ops WHERE status = 'pending' AND next_exec <= ? ORDER BY next_exec ASC",
  ).all(ts) as ScheduledOpRow[]
  return rows.map(parseOpRow)
}

export function updateScheduledOp(
  id: string,
  updates: { status?: string; exec_count?: number; next_exec?: number },
): void {
  const conn = getDb()
  const sets: string[] = []
  const values: (string | number)[] = []
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status) }
  if (updates.exec_count !== undefined) { sets.push('exec_count = ?'); values.push(updates.exec_count) }
  if (updates.next_exec !== undefined) { sets.push('next_exec = ?'); values.push(updates.next_exec) }
  if (sets.length === 0) return
  values.push(id)
  conn.prepare(`UPDATE scheduled_ops SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

export function cancelScheduledOp(id: string): void {
  const conn = getDb()
  const result = conn.prepare("UPDATE scheduled_ops SET status = 'cancelled' WHERE id = ?").run(id)
  if (result.changes === 0) throw new Error(`Scheduled op not found: ${id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity stream
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertActivityParams {
  agent: string
  level: string
  type: string
  title: string
  detail?: string
  wallet?: string
  actionable?: number
  action_type?: string
  action_data?: string
}

export interface ActivityOptions {
  limit?: number
  before?: string
  levels?: string[]
}

/** Insert an activity into the stream. Returns the ULID id. */
export function insertActivity(params: InsertActivityParams): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()

  conn.prepare(`
    INSERT INTO activity_stream
      (id, agent, level, type, title, detail, wallet, actionable, action_type, action_data, dismissed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    params.agent,
    params.level,
    params.type,
    params.title,
    params.detail ?? null,
    params.wallet ?? null,
    params.actionable ?? 0,
    params.action_type ?? null,
    params.action_data ?? null,
    now,
  )

  return id
}

/**
 * Query activity stream.
 * Pass wallet=null to retrieve across all wallets (global view).
 * Results are ordered newest first.
 */
export function getActivity(
  wallet: string | null,
  options: ActivityOptions = {},
): Array<Record<string, unknown>> {
  const conn = getDb()
  const limit = options.limit ?? 100
  const bindings: (string | number)[] = []
  const clauses: string[] = []

  if (wallet !== null) {
    clauses.push('wallet = ?')
    bindings.push(wallet)
  }

  if (options.levels && options.levels.length > 0) {
    const placeholders = options.levels.map(() => '?').join(', ')
    clauses.push(`level IN (${placeholders})`)
    bindings.push(...options.levels)
  }

  if (options.before) {
    clauses.push('created_at < ?')
    bindings.push(options.before)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  bindings.push(limit)

  return conn.prepare(`
    SELECT * FROM activity_stream ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?
  `).all(...bindings) as Array<Record<string, unknown>>
}

/** Mark an activity entry as dismissed. */
export function dismissActivity(id: string): void {
  const conn = getDb()
  conn.prepare('UPDATE activity_stream SET dismissed = 1 WHERE id = ?').run(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost log
// ─────────────────────────────────────────────────────────────────────────────

export interface LogCostParams {
  agent: string
  provider: string
  operation: string
  cost_usd: number
  tokens_in?: number
  tokens_out?: number
  resources?: number
}

/** Log an LLM/API cost entry. Returns the ULID id. */
export function logCost(params: LogCostParams): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()

  conn.prepare(`
    INSERT INTO cost_log
      (id, agent, provider, operation, tokens_in, tokens_out, resources, cost_usd, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.agent,
    params.provider,
    params.operation,
    params.tokens_in ?? null,
    params.tokens_out ?? null,
    params.resources ?? null,
    params.cost_usd,
    now,
  )

  return id
}

/**
 * Sum cost_usd grouped by agent for the given period.
 * Returns { agentName: totalCostUsd, ... }
 */
export function getCostTotals(period: 'today' | 'month'): Record<string, number> {
  const conn = getDb()
  const now = new Date()

  let since: string
  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }

  const rows = conn.prepare(
    'SELECT agent, SUM(cost_usd) as total FROM cost_log WHERE created_at >= ? GROUP BY agent',
  ).all(since) as Array<{ agent: string; total: number }>

  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.agent] = row.total
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent events
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentEventOptions {
  limit?: number
  since?: string
}

/** Log an inter-agent event. Returns the ULID id. */
export function logAgentEvent(
  from: string,
  to: string | null,
  type: string,
  payload: unknown,
): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()

  conn.prepare(`
    INSERT INTO agent_events (id, from_agent, to_agent, event_type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, from, to, type, JSON.stringify(payload), now)

  return id
}

/** Query agent events, newest first. */
export function getAgentEvents(
  options: AgentEventOptions = {},
): Array<Record<string, unknown>> {
  const conn = getDb()
  const limit = options.limit ?? 100
  const bindings: (string | number)[] = []
  const clauses: string[] = []

  if (options.since) {
    clauses.push('created_at >= ?')
    bindings.push(options.since)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  bindings.push(limit)

  return conn.prepare(`
    SELECT * FROM agent_events ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?
  `).all(...bindings) as Array<Record<string, unknown>>
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution links
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_EXEC_LINK_TTL_MS = 15 * 60 * 1000 // 15 minutes

export interface CreateExecutionLinkData {
  wallet?: string
  action: string
  params: Record<string, unknown>
  source: string
  expiresInMs?: number
}

/**
 * Create a short-lived execution link for wallet-signed actions.
 * Returns the ULID id that becomes the link token.
 */
export function createExecutionLink(data: CreateExecutionLinkData): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()
  const ttl = data.expiresInMs ?? DEFAULT_EXEC_LINK_TTL_MS
  const expiresAt = new Date(Date.now() + ttl).toISOString()

  conn.prepare(`
    INSERT INTO execution_links
      (id, wallet, action, params, source, status, expires_at, signed_tx, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, null, ?)
  `).run(
    id,
    data.wallet ?? null,
    data.action,
    JSON.stringify(data.params),
    data.source,
    expiresAt,
    now,
  )

  return id
}

/** Retrieve an execution link by id. Returns undefined if not found. */
export function getExecutionLink(id: string): Record<string, unknown> | undefined {
  const conn = getDb()
  return conn.prepare('SELECT * FROM execution_links WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

/** Columns that may be updated on execution_links (allowlist to prevent SQL injection). */
const EXECUTION_LINK_COLUMNS = new Set([
  'wallet', 'action', 'params', 'source', 'status', 'expires_at', 'signed_tx',
])

/** Update arbitrary fields on an execution link. Throws if the link doesn't exist. */
export function updateExecutionLink(id: string, updates: Record<string, unknown>): void {
  const conn = getDb()
  const keys = Object.keys(updates)
  if (keys.length === 0) return

  for (const key of keys) {
    if (!EXECUTION_LINK_COLUMNS.has(key)) {
      throw new Error(`Unknown column: ${key}`)
    }
  }

  const sets = keys.map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(updates) as (string | number | null)[], id]

  const result = conn.prepare(`UPDATE execution_links SET ${sets} WHERE id = ?`).run(...values)
  if (result.changes === 0) throw new Error(`Execution link not found: ${id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL — blacklist
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertBlacklistParams {
  address: string
  reason: string
  severity: 'warn' | 'block' | 'critical'
  addedBy: string
  expiresAt?: string
  sourceEventId?: string
}

export interface BlacklistEntry {
  id: string
  address: string
  reason: string
  severity: 'warn' | 'block' | 'critical'
  addedBy: string
  addedAt: string
  expiresAt: string | null
  removedAt: string | null
  removedBy: string | null
  removedReason: string | null
  sourceEventId: string | null
}

export function insertBlacklist(params: InsertBlacklistParams): string {
  const id = ulid()
  getDb().prepare(`
    INSERT INTO sentinel_blacklist
      (id, address, reason, severity, added_by, added_at, expires_at, source_event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.address,
    params.reason,
    params.severity,
    params.addedBy,
    new Date().toISOString(),
    params.expiresAt ?? null,
    params.sourceEventId ?? null,
  )
  return id
}

export function getActiveBlacklistEntry(address: string): BlacklistEntry | null {
  const row = getDb().prepare(`
    SELECT * FROM sentinel_blacklist
    WHERE address = ?
      AND removed_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY added_at DESC
    LIMIT 1
  `).get(address, new Date().toISOString()) as Record<string, unknown> | undefined
  return row ? rowToBlacklist(row) : null
}

export function softRemoveBlacklist(id: string, removedBy: string, reason: string): void {
  getDb().prepare(`
    UPDATE sentinel_blacklist
    SET removed_at = ?, removed_by = ?, removed_reason = ?
    WHERE id = ? AND removed_at IS NULL
  `).run(new Date().toISOString(), removedBy, reason, id)
}

export function listBlacklist(opts: { limit?: number; cursor?: string } = {}): BlacklistEntry[] {
  const limit = opts.limit ?? 50
  const now = new Date().toISOString()
  const rows = getDb().prepare(`
    SELECT * FROM sentinel_blacklist
    WHERE removed_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY added_at DESC
    LIMIT ?
  `).all(now, limit) as Record<string, unknown>[]
  return rows.map(rowToBlacklist)
}

export function countBlacklistAddedByInLastHour(addedBy: string): number {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const row = getDb().prepare(`
    SELECT COUNT(*) AS count FROM sentinel_blacklist
    WHERE added_by = ? AND added_at > ?
  `).get(addedBy, oneHourAgo) as { count: number }
  return row.count
}

function rowToBlacklist(r: Record<string, unknown>): BlacklistEntry {
  return {
    id: r.id as string,
    address: r.address as string,
    reason: r.reason as string,
    severity: r.severity as 'warn' | 'block' | 'critical',
    addedBy: r.added_by as string,
    addedAt: r.added_at as string,
    expiresAt: (r.expires_at as string | null) ?? null,
    removedAt: (r.removed_at as string | null) ?? null,
    removedBy: (r.removed_by as string | null) ?? null,
    removedReason: (r.removed_reason as string | null) ?? null,
    sourceEventId: (r.source_event_id as string | null) ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL — risk history
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertRiskHistoryParams {
  address: string
  risk: 'low' | 'medium' | 'high'
  score: number
  reasons: string[]
  recommendation: 'allow' | 'warn' | 'block'
  decisionId?: string
  contextAction?: string
  wallet?: string
}

export interface RiskHistoryRow {
  id: string
  address: string
  contextAction: string | null
  wallet: string | null
  risk: 'low' | 'medium' | 'high'
  score: number
  reasons: string[]
  recommendation: 'allow' | 'warn' | 'block'
  decisionId: string | null
  createdAt: string
}

export function insertRiskHistory(params: InsertRiskHistoryParams): string {
  const id = ulid()
  getDb().prepare(`
    INSERT INTO sentinel_risk_history
      (id, address, context_action, wallet, risk, score, reasons, recommendation, decision_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.address,
    params.contextAction ?? null,
    params.wallet ?? null,
    params.risk,
    params.score,
    JSON.stringify(params.reasons),
    params.recommendation,
    params.decisionId ?? null,
    new Date().toISOString(),
  )
  return id
}

export function getRiskHistory(address: string, limit = 20): RiskHistoryRow[] {
  const rows = getDb().prepare(`
    SELECT * FROM sentinel_risk_history
    WHERE address = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(address, limit) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    address: r.address as string,
    contextAction: (r.context_action as string | null) ?? null,
    wallet: (r.wallet as string | null) ?? null,
    risk: r.risk as 'low' | 'medium' | 'high',
    score: r.score as number,
    reasons: JSON.parse(r.reasons as string) as string[],
    recommendation: r.recommendation as 'allow' | 'warn' | 'block',
    decisionId: (r.decision_id as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL — pending actions (circuit breaker)
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertPendingActionParams {
  actionType: 'refund' | 'blacklist' | 'alert' | string
  payload: Record<string, unknown>
  reasoning: string
  wallet: string
  delayMs: number
  decisionId?: string
}

export interface PendingActionRow {
  id: string
  actionType: string
  payload: Record<string, unknown>
  reasoning: string
  wallet: string
  scheduledAt: string
  executeAt: string
  status: 'pending' | 'executing' | 'executed' | 'cancelled'
  executedAt: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancelReason: string | null
  result: Record<string, unknown> | null
  decisionId: string | null
}

export function insertPendingAction(params: InsertPendingActionParams): string {
  const id = ulid()
  const now = new Date()
  const scheduledAt = now.toISOString()
  const executeAt = new Date(now.getTime() + params.delayMs).toISOString()
  getDb().prepare(`
    INSERT INTO sentinel_pending_actions
      (id, action_type, payload, reasoning, wallet, scheduled_at, execute_at, status, decision_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    id,
    params.actionType,
    JSON.stringify(params.payload),
    params.reasoning,
    params.wallet,
    scheduledAt,
    executeAt,
    params.decisionId ?? null,
  )
  return id
}

export function getPendingAction(id: string): PendingActionRow | null {
  const row = getDb().prepare(`SELECT * FROM sentinel_pending_actions WHERE id = ?`).get(id) as
    | Record<string, unknown> | undefined
  return row ? rowToPending(row) : null
}

export function getDuePendingActions(): PendingActionRow[] {
  const now = new Date().toISOString()
  const rows = getDb().prepare(`
    SELECT * FROM sentinel_pending_actions
    WHERE status = 'pending' AND execute_at <= ?
    ORDER BY execute_at ASC
  `).all(now) as Record<string, unknown>[]
  return rows.map(rowToPending)
}

export function getAllPendingActionsWithStatus(status: 'pending' | 'executing'): PendingActionRow[] {
  const rows = getDb().prepare(`
    SELECT * FROM sentinel_pending_actions WHERE status = ? ORDER BY execute_at ASC
  `).all(status) as Record<string, unknown>[]
  return rows.map(rowToPending)
}

export function listPendingActions(opts: { wallet?: string; status?: string; limit?: number } = {}): PendingActionRow[] {
  const limit = opts.limit ?? 50
  let sql = `SELECT * FROM sentinel_pending_actions WHERE 1=1`
  const bind: unknown[] = []
  if (opts.wallet) {
    sql += ` AND wallet = ?`
    bind.push(opts.wallet)
  }
  if (opts.status) {
    sql += ` AND status = ?`
    bind.push(opts.status)
  }
  sql += ` ORDER BY scheduled_at DESC LIMIT ?`
  bind.push(limit)
  const rows = getDb().prepare(sql).all(...bind) as Record<string, unknown>[]
  return rows.map(rowToPending)
}

export function cancelPendingAction(id: string, cancelledBy: string, reason: string): void {
  getDb().prepare(`
    UPDATE sentinel_pending_actions
    SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?
    WHERE id = ? AND status = 'pending'
  `).run(new Date().toISOString(), cancelledBy, reason, id)
}

export function markPendingActionExecuting(id: string): void {
  getDb().prepare(`
    UPDATE sentinel_pending_actions SET status = 'executing' WHERE id = ? AND status = 'pending'
  `).run(id)
}

export function markPendingActionExecuted(id: string, result: Record<string, unknown>): void {
  getDb().prepare(`
    UPDATE sentinel_pending_actions
    SET status = 'executed', executed_at = ?, result = ?
    WHERE id = ?
  `).run(new Date().toISOString(), JSON.stringify(result), id)
}

export function countFundActionsInLastHour(wallet: string): number {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const row = getDb().prepare(`
    SELECT COUNT(*) AS count FROM sentinel_pending_actions
    WHERE wallet = ? AND action_type = 'refund'
      AND scheduled_at > ?
      AND status != 'cancelled'
  `).get(wallet, oneHourAgo) as { count: number }
  return row.count
}

function rowToPending(r: Record<string, unknown>): PendingActionRow {
  return {
    id: r.id as string,
    actionType: r.action_type as string,
    payload: JSON.parse(r.payload as string) as Record<string, unknown>,
    reasoning: r.reasoning as string,
    wallet: r.wallet as string,
    scheduledAt: r.scheduled_at as string,
    executeAt: r.execute_at as string,
    status: r.status as PendingActionRow['status'],
    executedAt: (r.executed_at as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    cancelledBy: (r.cancelled_by as string | null) ?? null,
    cancelReason: (r.cancel_reason as string | null) ?? null,
    result: r.result ? (JSON.parse(r.result as string) as Record<string, unknown>) : null,
    decisionId: (r.decision_id as string | null) ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL — decisions (audit trail)
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionToolCall {
  name: string
  args: Record<string, unknown>
  result: unknown
}

export interface DecisionRow {
  id: string
  invocationSource: 'reactive' | 'preflight' | 'query'
  triggerEventId: string | null
  triggerContext: Record<string, unknown>
  model: string
  durationMs: number
  toolCalls: DecisionToolCall[]
  reasoning: string | null
  verdict: 'allow' | 'warn' | 'block' | 'action-taken' | 'error' | 'pending'
  verdictDetail: Record<string, unknown> | null
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
  createdAt: string
}

export interface InsertDecisionDraftParams {
  invocationSource: 'reactive' | 'preflight' | 'query'
  triggerEventId?: string
  triggerContext: Record<string, unknown>
  model: string
}

export function insertDecisionDraft(params: InsertDecisionDraftParams): string {
  const id = ulid()
  getDb().prepare(`
    INSERT INTO sentinel_decisions
      (id, invocation_source, trigger_event_id, trigger_context, model, duration_ms,
       tool_calls, verdict, created_at)
    VALUES (?, ?, ?, ?, ?, 0, '[]', 'pending', ?)
  `).run(
    id,
    params.invocationSource,
    params.triggerEventId ?? null,
    JSON.stringify(params.triggerContext),
    params.model,
    new Date().toISOString(),
  )
  return id
}

export function appendDecisionToolCall(id: string, call: DecisionToolCall): void {
  const db = getDb()
  const current = db.prepare(`SELECT tool_calls FROM sentinel_decisions WHERE id = ?`).get(id) as
    | { tool_calls: string } | undefined
  if (!current) throw new Error(`decision ${id} not found`)
  const arr = JSON.parse(current.tool_calls) as DecisionToolCall[]
  arr.push(call)
  db.prepare(`UPDATE sentinel_decisions SET tool_calls = ? WHERE id = ?`)
    .run(JSON.stringify(arr), id)
}

export interface FinalizeDecisionParams {
  verdict: 'allow' | 'warn' | 'block' | 'action-taken' | 'error'
  verdictDetail: Record<string, unknown>
  reasoning: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export function finalizeDecision(id: string, params: FinalizeDecisionParams): void {
  const result = getDb().prepare(`
    UPDATE sentinel_decisions
    SET verdict = ?, verdict_detail = ?, reasoning = ?, duration_ms = ?,
        input_tokens = ?, output_tokens = ?, cost_usd = ?
    WHERE id = ?
  `).run(
    params.verdict,
    JSON.stringify(params.verdictDetail),
    params.reasoning,
    params.durationMs,
    params.inputTokens,
    params.outputTokens,
    params.costUsd,
    id,
  )
  if (result.changes === 0) throw new Error(`finalizeDecision: ${id} not updated`)
}

export function getDecision(id: string): DecisionRow | null {
  const row = getDb().prepare(`SELECT * FROM sentinel_decisions WHERE id = ?`).get(id) as
    | Record<string, unknown> | undefined
  return row ? rowToDecision(row) : null
}

export function listDecisions(opts: { limit?: number; source?: string } = {}): DecisionRow[] {
  const limit = opts.limit ?? 50
  let sql = `SELECT * FROM sentinel_decisions`
  const bind: unknown[] = []
  if (opts.source) {
    sql += ` WHERE invocation_source = ?`
    bind.push(opts.source)
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`
  bind.push(limit)
  const rows = getDb().prepare(sql).all(...bind) as Record<string, unknown>[]
  return rows.map(rowToDecision)
}

export function dailyDecisionCostUsd(): number {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) AS total FROM sentinel_decisions
    WHERE created_at > ?
  `).get(oneDayAgo) as { total: number }
  return row.total
}

function rowToDecision(r: Record<string, unknown>): DecisionRow {
  return {
    id: r.id as string,
    invocationSource: r.invocation_source as DecisionRow['invocationSource'],
    triggerEventId: (r.trigger_event_id as string | null) ?? null,
    triggerContext: JSON.parse((r.trigger_context as string | null) ?? '{}') as Record<string, unknown>,
    model: r.model as string,
    durationMs: r.duration_ms as number,
    toolCalls: JSON.parse(r.tool_calls as string) as DecisionToolCall[],
    reasoning: (r.reasoning as string | null) ?? null,
    verdict: r.verdict as DecisionRow['verdict'],
    verdictDetail: r.verdict_detail ? JSON.parse(r.verdict_detail as string) : null,
    inputTokens: (r.input_tokens as number | null) ?? null,
    outputTokens: (r.output_tokens as number | null) ?? null,
    costUsd: (r.cost_usd as number | null) ?? null,
    createdAt: r.created_at as string,
  }
}
