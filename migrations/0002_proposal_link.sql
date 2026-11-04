-- Link user-approved proposals to permanent memories.
ALTER TABLE memory_proposals ADD COLUMN accepted_memory_id TEXT REFERENCES memories(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_accepted_memory ON memory_proposals(accepted_memory_id) WHERE accepted_memory_id IS NOT NULL;
