# MVP v1.1

**Product:** Cloud-accessible personal memory, backed by a source-aware data store and securely queryable by compatible AI clients.

## Non-negotiables
- $0/month target, no automatic charges.
- Public source, private memories and secrets.
- User reviews AI-suggested additions.
- Cross-device access.
- Exportable, versioned data.
- No fake credentials, metrics or career accomplishments.

## MVP phases
1. Foundation: repository, migrations, protected Worker, tests and CI.
2. Memory API: create/list/search/update/archive; preserve revisions.
3. Private dashboard, strong authentication and approval UI.
4. Data exports and tested restore.
5. Read-only remote MCP, OAuth, client compatibility testing.
6. Resume-aware retrieval and source integrity evaluation.

## Explicitly out of scope
Automatic sync of proprietary AI-provider memory, paid inference, company-wide search, full Omni deployment, Redis as a mandatory service, unattended writes to personal fact records.

## Release gates
No public production launch until auth, permissions, auditability, quotas, backups and smoke tests pass. The current single-user Bearer token is **development-only**, not a substitute for production OAuth or a secure browser session.
