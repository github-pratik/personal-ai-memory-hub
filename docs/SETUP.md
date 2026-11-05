# Development and live deployment setup

## Local development

Requires Node.js 22+, npm, and Wrangler.

```bash
npm install
npm run check
npx wrangler d1 migrations apply memory-hub --local
npm run dev
```

Create a local `.dev.vars` from `.env.example` with `MEMORY_API_TOKEN` set to a **random, at least 32-character secret** (40+ recommended). Never commit secrets. The browser dashboard uses a signed HttpOnly cookie after logging in.

Public check: `GET /health`. Protected API: `/v1/*`, and `/mcp`.

## Hosted instance

- URL: https://personal-ai-memory-hub.p-pshpatil.workers.dev
- Cloudflare D1 database: `memory-hub`
- Deployment: GitHub Actions → **Deploy to Cloudflare (manual, free-tier only)** → **Run workflow** on latest `main`
- Environment: GitHub `production`
- Required environment secrets: `CLOUDFLARE_API_TOKEN`, `MEMORY_API_TOKEN`
- Optional separate agent environment secret: `MEMORY_AGENT_TOKEN`

**Important:** `Re-run all jobs` on an older workflow reuses the older commit. To deploy the newest changes, start a new workflow run.

The dashboard login has been tested live. The MCP endpoint exists but no real third-party AI client is verified connected yet.

## Agent integration

Read [MCP.md](MCP.md) and [GROK.md](GROK.md). Keep the owner login key private. If connecting agents, provision a separate restricted agent token. Some clients need an OAuth flow and cannot use fixed Bearer headers.

## Optional email OTP

Cloudflare Access email OTP code support is prepared but **not enabled**. Do not set `ACCESS_REQUIRED=true` without first configuring the Cloudflare Access policy and authorized email. Follow [CLOUDFLARE_ACCESS_OTP.md](CLOUDFLARE_ACCESS_OTP.md).

## Safety

Do not store passwords, tokens, private backups, personal memory content, or employer confidential data in the public repository. Cloudflare's free-tier usage and terms may change.
