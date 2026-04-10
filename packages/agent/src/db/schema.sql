-- Sipher Agent — SQLite Schema
-- Tables: sessions, audit_log, scheduled_ops, payment_links

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,           -- sha256(wallet_pubkey)
  wallet TEXT NOT NULL UNIQUE,
  preferences TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'send', 'deposit', 'swap', etc.
  params TEXT NOT NULL,          -- sanitized JSON (no keys/secrets)
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'prepared',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS scheduled_ops (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  params TEXT NOT NULL,          -- encrypted JSON
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
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_ops(next_exec, status);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_links(status, expires_at);
