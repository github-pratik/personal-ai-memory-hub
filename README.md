# Personal AI Memory Hub

![CI](https://github.com/github-pratik/personal-ai-memory-hub/actions/workflows/ci.yml/badge.svg)

**One private, user-controlled memory source for multiple AI assistants.**

**Public code. Private memories. No required paid LLM API.** Hosting targets Cloudflare's free allowances.

## The goal: connect AI assistants to the same trusted memory

You should not have to re-explain your projects, skills, experience and preferences independently to ChatGPT, Claude, Grok and Gemini. The Memory Hub stores owner-approved facts once and makes them available through a protected, standard **Model Context Protocol (MCP)** endpoint to compatible clients.

```text
ChatGPT / Claude / Grok / Gemini / compatible MCP clients
                    |
           secure MCP integration
                    |
   Personal AI Memory Hub (Cloudflare Worker)
        |                  |
   3 read + 2 propose    private dashboard
        |                  |
             Cloudflare D1
      approved facts + provenance
```

**Core mission:** interoperate with AI assistants. The dashboard, job application tracking and resume instructions are workflows on that shared memory, not the final product on their own. **Current rollout priority: connecting and verifying real AI clients before importing personal career facts.**

## Live deployment

- **Worker:** https://personal-ai-memory-hub.p-pshpatil.workers.dev
- **MCP endpoint:** `https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp`
- **Status:** Live Worker and dashboard. **Two-way ChatGPT ↔ Claude memory sharing verified November 5, 2026 (owner-reported):** both clients discovered five tools, submitted user-requested proposals, and retrieved owner-approved changes from the same database. Grok/Gemini remain unverified.
- **Memory database:** contains a synthetic integration-test memory. Real career facts have not been imported as part of this verification.
- **Email OTP:** Cloudflare Access integration code exists, but Access policy and passwordless browser sign-in are **not enabled**. The current login uses a private access key.

The public endpoint does **not** mean private memory is publicly accessible: private API and MCP requests require configured credentials.

## Current capabilities

- Single-user private dashboard with signed, HttpOnly sessions and same-origin form protection.
- Create, search, update, archive and revision approved memories in Cloudflare D1.
- Queue AI-suggested facts for explicit owner approval or rejection.
- Bulk import and JSON backup/export.
- Rank approved career evidence against job descriptions using free keyword matching (not a generative model).
- Separate restricted Bearer credentials and deployed OAuth discovery/PKCE endpoints. The successful ChatGPT and Claude real-client connections used restricted Bearer headers; hosted-client OAuth sign-in is not verified.
- Authenticated remote JSON-RPC MCP endpoint exposing **three read-only tools and two pending-proposal tools**:
  - `search_memory` — query source-linked, approved memories.
  - `get_memory` — fetch one approved memory by ID.
  - `match_job` — rank evidence against a job description.
  - `propose_memory` — submit a new user-requested suggestion to the **pending owner-review queue**, never directly to approved memories.
  - `propose_memory_update` — propose replacing an existing approved fact, with version checking and explicit owner approval.
- GitHub Actions CI with unit tests, Worker smoke tests and D1 migration tests; manual Cloudflare deployment.

## Verified cross-assistant workflow

On November 5, 2026, the owner verified **Claude → Memory Hub → ChatGPT** and **ChatGPT → Memory Hub → Claude** using one synthetic record. Claude initially proposed, the owner approved and retrieved it. Claude then proposed a correction, which the owner approved using the explicit archived-memory recovery path. ChatGPT retrieved the same memory and later submitted correction proposal `57b7c291-cc87-4bec-8ad5-148239c1adab`; after owner approval, Claude retrieved memory `c6b82a21-761e-842b-845e-1516025adda5` with title **MCP Cross-Assistant Integration - Verified** and timestamp `2026-11-05T05:42:34.581Z`. Pending proposals never became trusted facts until owner approval. The product still needs a Grok integration and stronger production security testing.

## Assistant integration roadmap

| Assistant | Path | Verified in real client? |
|---|---|---|
| **Grok** | Grok **Custom MCP Connector** or Grok Build remote HTTP MCP | **Not yet** |
| **Claude** | Custom remote MCP with restricted Bearer header | **Verified: create proposal, read, propose correction, and read ChatGPT-approved correction** |
| **ChatGPT** | Custom Streamable HTTP MCP with restricted Bearer header | **Verified: five tools, search/read, propose correction, and Claude readback** |
| **Gemini** | Compatible MCP client or adapter, subject to its available runtime | **Not yet** |
| Other MCP clients | Streamable HTTP compatibility and credential configuration | **Not yet** |

**Integration instructions:** [Grok](docs/GROK.md) · [MCP protocol and tests](docs/MCP.md). CI verifies local/protocol behavior; cross-assistant results are separately supported by owner-reported real-client tool responses.

## Security architecture

| Layer | Implementation |
|---|---|
| Hosting | Cloudflare Worker, TypeScript |
| Data store | Cloudflare D1 (SQLite) with revision tracking |
| Browser session | Signed 12-hour HttpOnly cookie |
| Optional browser SSO | Cloudflare Access email OTP (not yet enabled) |
| MCP and REST API | Restricted Bearer credentials; OAuth + PKCE code deployed and endpoints probed, but hosted-client OAuth login unverified |
| Memory integrity | Approved facts only; owner-reviewed new and correction proposals |
| Evidence matching | Deterministic keyword overlap |
| Agent access | Narrower than owner access; MCP can read approved records and submit pending proposals only |

**OAuth is deployed but full hosted-client OAuth sign-in remains unverified.** It adds DCR-based client registration, metadata discovery, signed-in owner consent, strict audience/scopes, and short-lived hashed access tokens. The Claude fixed-header integration remains supported. **Never paste or commit** API tokens, career records, private exports, or confidential employer data. Before connecting an external assistant, use a **separate `MEMORY_AGENT_TOKEN`**, not your dashboard's master key. Check which authentication schemes that assistant actually supports and do not bypass authentication for convenience.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run check
npx wrangler d1 migrations apply memory-hub --local
```

Create a local `.dev.vars` from `.env.example` with a **random, at least 32-character** `MEMORY_API_TOKEN` (40+ recommended). Never commit it. Run `npm run dev`.

## Documentation

- [Project purpose and MVP](docs/MVP.md)
- [Current status and outstanding integration gates](docs/STATUS.md)
- [Remote MCP tools and authentication](docs/MCP.md)
- [Cross-assistant memory updates, job applications and resume guidelines](docs/CROSS_ASSISTANT_UPDATES.md)
- [Grok connector setup](docs/GROK.md)
- [OAuth requirements and live verification checklist](docs/OAUTH_REQUIREMENTS.md)
- [Deployment instructions](docs/DEPLOYMENT.md)
- [Cloudflare Access email OTP](docs/CLOUDFLARE_ACCESS_OTP.md)
- [Security and privacy](docs/SECURITY.md)
- [Local development](docs/SETUP.md)
- [Career evidence workflow](docs/JOB_APPLICATION_WORKFLOW.md)
- [Cloudflare developer tooling (separate management MCP)](docs/CLOUDFLARE_AGENT_TOOLS.md)
- [Agent development guidelines](AGENTS.md)
- [Issues and roadmap](https://github.com/github-pratik/personal-ai-memory-hub/issues)

## Cost, limits and license

Designed around free Cloudflare Workers and D1 usage, with **no required paid LLM API**. Free plans have usage limits and are not a guarantee of permanent $0 cost. This is an evolving single-user project, not a completed multi-provider authentication system or independently audited security product.

[MIT License](LICENSE)
