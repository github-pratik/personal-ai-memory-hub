# Engineering status

Updated: November 4, 2026.

## Implemented in repository
- Browser dashboard (signed HttpOnly cookie sessions, origin-checked forms).
- Memory create, search, update, archive with D1 revisions.
- Bulk verified-memory import (up to 25 per request, deterministic IDs).
- AI-suggested proposal queue, owner approve/reject actions.
- Job-description matching against approved experience/projects (free deterministic ranking).
- Private JSON backup export.
- Read-only remote MCP protocol endpoint (Bearer auth, three retrieval tools).
- Role separation for owner versus agent tokens.
- D1 migrations and unit/API/end-to-end smoke tests in GitHub Actions.
- Manual Cloudflare deployment workflow, public source, MIT license, GitHub issue backlog.

## Verification
- CI includes TypeScript checks, tests, D1 local migrations and Worker HTTP smoke tests.
- **Check the latest GitHub Actions run for its actual result.**
- No remote deployment performed. No Cloudflare credentials or real personal data have been committed.

## Still required for production use
- Cloudflare account connection, D1 provisioning, owner login secret, deployment.
- Independent production security review; rate limiting and backup-restoration tests.
- Client-specific MCP OAuth compatibility.
- Personal data import through the private dashboard, not through GitHub.
- Verified end-user tests from two different devices.

## Product priority
Job-application evidence retrieval first. Zero-cost target, accurate professional facts, private data, cross-device operation.
