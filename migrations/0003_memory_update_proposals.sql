-- Agent-suggested corrections to existing approved memories require owner review.
-- Store a snapshot version to reject stale corrections instead of overwriting newer facts.
CREATE TABLE IF NOT EXISTS memory_update_proposals (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id),
  target_updated_at TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 12000),
  category TEXT NOT NULL CHECK(category IN ('experience','project','skill','education','preference','other')),
  source TEXT NOT NULL CHECK(length(source) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_update_proposals_status ON memory_update_proposals(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_update_proposals_memory ON memory_update_proposals(memory_id,created_at DESC);
