-- One fixed-size counter prevents unbounded records from public sign-in attempts.
-- All owner login attempts share a window because client IP headers are untrusted.
CREATE TABLE IF NOT EXISTS oauth_login_limits (
  name TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 1)
);
