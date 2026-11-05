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
   3 read-only tools    private dashboard
        |                  |
             Cloudflare D1
      approved facts + provenance
```

**Core mission:** interoperate with AI assistants. The dashboard and resume features are interfaces to that shared memory, not the final product on their own. **Current rollout priority: connecting and verifying real AI clients before importing personal career facts.**

## Live deployment

- **Worker:** https://personal-ai-memory-hub.p-pshpatil.workers.dev
- **MCP endpoint:** `https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp`
- **Status:** Worker deployed; private browser login and dashboard verified by the owner, GitHub CI green on the login fix. Remote MCP client login/tool execution is **not yet verified**.
- **Memory database:** empty by choice during integration setup; no production career facts should be published to this repository.
- **Email OTP:** Cloudflare Access integration code exists, but Access policy and passwordless browser sign-in are **not enabled**. The current login uses a private access key.

The public endpoint does **not** mean private memory is publicly accessible: private API and MCP requests require configured credentials.

## Current capabilities

- Single-user private dashboard with signed, HttpOnly sessions and same-origin form protection.
- Create, search, update, archive and revision approved memories in Cloudflare D1.
- Queue AI-suggested facts for explicit owner approval or rejection.
- Bulk import and JSON backup/export.
- Rank approved career evidence against job descriptions using free keyword matching (not a generative model).
- Separate owner and agent Bearer credentials.
- Read-only remote JSON-RPC MCP endpoint exposing:
  - `search_memory` — query source-linked, approved memories.
  - `get_memory` — fetch one approved memory by ID.
  - `match_job` — rank evidence against a job description.
- GitHub Actions CI with unit tests, Worker smoke tests and D1 migration tests; manual Cloudflare deployment.

## Assistant integration roadmap

| Assistant | Path | Verified in real client? |
|---|---|---|
| **Grok** | Grok **Custom MCP Connector** or Grok Build remote HTTP MCP | **Not yet** |
| **Claude** | Supported custom remote MCP connector, depending on client/plan | **Not yet** |
| **ChatGPT** | Custom MCP/plugin connection subject to current authentication and account support | **Not yet** |
| **Gemini** | Compatible MCP client or adapter, subject to its available runtime | **Not yet** |
| Other MCP clients | Streamable HTTP compatibility and credential configuration | **Not yet** |

**Integration instructions:** [Grok](docs/GROK.md) · [MCP protocol and tests](docs/MCP.md). Passing CI proves the Worker behavior, **not** successful connection to any provider.

## Security architecture

| Layer | Implementation |
|---|---|
| Hosting | Cloudflare Worker, TypeScript |
| Data store | Cloudflare D1 (SQLite) with revision tracking |
| Browser session | Signed 12-hour HttpOnly cookie |
| Optional browser SSO | Cloudflare Access email OTP (not yet enabled) |
| MCP and REST API | HTTPS + owner/agent Bearer tokens |
| Memory integrity | Approved facts only; pending AI suggestions |
| Evidence matching | Deterministic keyword overlap |
| Agent access | Narrower than owner access; MCP tools are read-only |

**Never paste or commit** API tokens, career records, private exports, or confidential employer data. Before connecting an external assistant, use a **separate `MEMORY_AGENT_TOKEN`**, not your dashboard's master key. Check which authentication schemes that assistant actually supports and do not bypass authentication for convenience.

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
- [Grok connector setup](docs/GROK.md)
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
