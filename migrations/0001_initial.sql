-- Single-user MVP. Never put real personal memories in source control.
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 12000),
  category TEXT NOT NULL CHECK (category IN ('experience','project','skill','education','preference','other')),
  source TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 500),
  state TEXT NOT NULL DEFAULT 'approved' CHECK (state IN ('approved','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_state_category ON memories(state, category);
CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);
CREATE TABLE IF NOT EXISTS memory_revisions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','archive'))
);
CREATE INDEX IF NOT EXISTS idx_revisions_memory ON memory_revisions(memory_id,changed_at DESC);
CREATE TABLE IF NOT EXISTS memory_proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON memory_proposals(status,created_at DESC);
