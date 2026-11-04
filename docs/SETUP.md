# Development setup

Prerequisites: Node.js 22+, npm, a Cloudflare account for future deployment.

```bash
npm install
npm run check
npx wrangler d1 migrations apply memory-hub --local
npm run dev
```

Create a local `.dev.vars` from `.env.example` with a newly generated random token of at least 32 characters. **Do not commit it.** Use a local CLI client for authenticated API testing. The dashboard and OAuth are not implemented yet.

Before remote deployment: create a Cloudflare D1 database, replace the placeholder in `wrangler.jsonc`, configure a secret using `wrangler secret put MEMORY_API_TOKEN`, test migrations, review provider free-tier terms, and complete security review. No production deployment has been performed.

Health check: `GET /health` (public, returns no private data).
Protected endpoints: `GET|POST /v1/memories`, `GET|PATCH|DELETE /v1/memories/:id`, and `GET|POST /v1/proposals`. All require `Authorization: Bearer <secret>`.

**Caution:** This is early implementation code, not yet hardened for live public exposure. API input validation and revision history are included; quota control, OAuth, proposal approval workflow, browser UI, MCP and backups are pending.
