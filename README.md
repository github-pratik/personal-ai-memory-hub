# Personal AI Memory Hub

![CI](https://github.com/github-pratik/personal-ai-memory-hub/actions/workflows/ci.yml/badge.svg)

**Open-source personal knowledge infrastructure for job applications and compatible AI assistants.**

**Public code. Private facts. No required paid LLM API.**

## Why this exists

People repeatedly explain the same work experience, projects, skills and career preferences to different AI assistants. This project maintains an **approved source of truth** accessible from authorized devices, so a resume is grounded in real evidence rather than invented achievements.

## Working features (locally tested)

- Private browser dashboard with signed, HttpOnly sessions.
- Add, search and archive approved experience, projects and skills.
- Review and approve or reject AI-proposed facts.
- Bulk-import verified facts from JSON and restore approved facts from JSON backup exports.
- Export memories, revisions and proposals as private JSON.
- Paste a job description and retrieve matching source-linked career evidence without paid inference.
- Role-separated owner and agent API credentials.
- Authenticated, **read-only MCP prototype**: `search_memory`, `get_memory`, `match_job`.
- GitHub Actions tests with local Cloudflare D1 migrations and real Worker API smoke tests.

## Architecture

| Layer | Implementation |
|---|---|
| Server and UI | Cloudflare Worker, TypeScript, server-rendered HTML |
| Database | Cloudflare D1 (SQLite) |
| Career evidence matching | Deterministic keyword overlap |
| Sessions | Signed 12-hour HttpOnly cookie |
| AI interoperability | JSON-RPC MCP over HTTPS, Bearer authentication |
| Optional future services | OAuth, free-model routing, Redis only if justified |

## Try locally

Requires Node.js 22+.

```bash
npm install
npm run check
npx wrangler d1 migrations apply memory-hub --local
```

Create a local `.dev.vars` containing `MEMORY_API_TOKEN=<your-strong-random-token>`, never commit it. Replace the placeholder with a secret of 40+ random characters. Then:

```bash
npm run dev
```

Open the local Worker URL, sign in, and add a synthetic test memory. Private information should only be used after reviewing the security model and creating backups.

## Hosting

The deployment workflow is prepared, but **the service has not been deployed**. A user-controlled Cloudflare account and D1 database must be authorized first. See [deployment setup](docs/DEPLOYMENT.md).

Our $0/month goal assumes workloads remain within provider free-tier allowances; free capacity and terms may change.

## Docs and development

- [Current status](docs/STATUS.md)
- [Product scope](docs/MVP.md)
- [Job application workflow](docs/JOB_APPLICATION_WORKFLOW.md)
- [Deployment and one-time account setup](docs/DEPLOYMENT.md)
- [Remote MCP protocol](docs/MCP.md)
- [Security model](docs/SECURITY.md)
- [Agent development instructions](AGENTS.md)
- [Issues and roadmap](https://github.com/github-pratik/personal-ai-memory-hub/issues)

## Security and limitations

- **Never commit** personal memories, resumes, access tokens, work-confidential data or production exports.
- AI suggestions are pending until the owner approves them.
- Bearer-authenticated MCP is implemented, but **ChatGPT, Claude and Grok connectivity is not yet universally verified** and may require OAuth support.
- The current login design is suitable for personal MVP evaluation, not an audited multi-user product.
- A production security and quota review is still required.

## License

[MIT](LICENSE)
