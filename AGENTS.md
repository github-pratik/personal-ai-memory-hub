# Agent Operating Instructions

## Mission
Build a user-controlled, secure, zero-cost-target cross-platform memory hub. The public repository must **never** contain personal facts, credentials, employer data, production database dumps or tokens.

## Delivery process
1. Work from a GitHub issue with acceptance criteria.
2. Keep changes small; include automated tests.
3. Run typecheck and tests; do not claim a check passed without evidence.
4. Protect user data. Fail closed on authentication errors.
5. Do not make unnecessary infrastructure additions (Redis, agent frameworks, paid LLMs) without benchmarking.
6. No automatic approval of AI-generated memory facts. The `propose_memory` and `propose_memory_update` MCP tools may write **pending proposals only**, after an explicit user request; approved memories always need owner confirmation.
7. No deployment without a secret, access-control review and quota controls.
8. Report progress as completed, verified, blocked, next.

## Agent roles
- **Tech lead/orchestrator:** priorities, reviews, security gates and reports.
- **Backend:** Worker API, validation and data consistency.
- **Data:** D1 migrations, revisions, backups and retrieval.
- **Frontend:** accessible authenticated dashboard.
- **QA/security:** auth bypass tests, database isolation, dependency review and CI.

These are task roles, not evidence that separate processes are currently running.

## Definition of done
Implemented, tested, reviewed, documented and linked to an issue. Mark blocked when credentials or account permissions are required.

## Cloudflare engineering tools

Cloudflare-maintained skills are installed in `.agents/skills/`:
- `cloudflare` for routing Cloudflare architecture questions to relevant products and docs;
- `wrangler` for Workers and D1 development/deployment;
- `workers-best-practices` for secure and reliable Cloudflare Workers;
- `agents-sdk` as optional guidance only (do not add Agents SDK unless justified).

Before changing Worker infrastructure, load the relevant skill and consult official Cloudflare docs. This project already uses `wrangler.jsonc`, so follow the Wrangler skill instead of migrating to a different CLI without approval.

The official Cloudflare management MCP endpoint is configured in `.mcp.json` at `https://mcp.cloudflare.com/mcp`. **It requires explicit Cloudflare OAuth authorization in a compatible execution client and is separate from our app's own `/mcp` endpoint.** No agent may infer account access merely because the config file exists. See [docs/CLOUDFLARE_AGENT_TOOLS.md](docs/CLOUDFLARE_AGENT_TOOLS.md).
