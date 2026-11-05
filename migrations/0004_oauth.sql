-- OAuth for ChatGPT/Grok and other MCP hosts. No token or authorization code stored in plaintext.
CREATE TABLE IF NOT EXISTS oauth_clients (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 redirect_uris TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_codes (
 code_hash TEXT PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES oauth_clients(id),
 redirect_uri TEXT NOT NULL,
 code_challenge TEXT NOT NULL,
 resource TEXT NOT NULL,
 scopes TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER
);
CREATE TABLE IF NOT EXISTS oauth_tokens (
 token_hash TEXT PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES oauth_clients(id),
 resource TEXT NOT NULL,
 scopes TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expiry ON oauth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expiry ON oauth_tokens(expires_at);
