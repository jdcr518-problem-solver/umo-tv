-- UMO TV D1 Database Schema
-- Persistence for guest sessions, abuse prevention, blocking, and audit logs

CREATE TABLE IF NOT EXISTS guest_sessions (
  session_id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  is_banned INTEGER DEFAULT 0,
  ban_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_ip ON guest_sessions(ip_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON guest_sessions(expires_at);

CREATE TABLE IF NOT EXISTS blocked_peers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_session_id TEXT NOT NULL,
  blocked_session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(blocker_session_id, blocked_session_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocked_peers(blocker_session_id);

CREATE TABLE IF NOT EXISTS abuse_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_session_id TEXT NOT NULL,
  reported_session_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  reporter_ip_hash TEXT NOT NULL,
  reported_ip_hash TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_reported ON abuse_reports(reported_session_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON abuse_reports(created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  counter INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
