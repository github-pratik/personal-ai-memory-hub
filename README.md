# Personal AI Memory Hub

> Open-source, cloud-hosted personal memory for compatible AI assistants. **Public code, private data.**

**Status:** early MVP development. This is NOT a production-ready service. No personal memories or credentials belong in this repository.

## Product goal

Access trustworthy, source-aware memories from multiple devices and compatible AI clients through an authenticated API and (later) remote MCP. The software is intended to run within free-service allowances but **$0/month is a target, not a guarantee of provider availability**.

## Initial architecture

- Cloudflare Workers: HTTP API (TypeScript).
- Cloudflare D1: authoritative memory, proposals and revisions.
- SQLite query search first; full-text and embeddings later.
- Cloudflare free `workers.dev` endpoint and account-level secrets.
- Redis is optional and deliberately omitted from the first build.

## Security rules

- The service denies all private API requests unless configured with a secret.
- Never put API keys, passwords, access tokens, unredacted resumes, or personal records in this public repository.
- Do **not** deploy the MVP publicly before validating authentication, authorization, quotas, and backup/restore.
- AI-proposed facts are **not** accepted automatically.

## Developer quick start

```bash
npm install
npm run typecheck
npm test
npx wrangler d1 migrations apply memory-hub --local
npm run dev
```

Set the `MEMORY_API_TOKEN` secret in your local `.dev.vars` (ignored by git). Read [docs/SETUP.md](docs/SETUP.md) before deployment.

## Work tracking

See [open issues](https://github.com/github-pratik/personal-ai-memory-hub/issues), [AGENTS.md](AGENTS.md), [MVP scope](docs/MVP.md), and [security model](docs/SECURITY.md).

## Contributing

Contributions welcome after the project foundation is reviewed. Never upload real user memory or work-confidential information in examples or issues.

## License

MIT. See [LICENSE](LICENSE).
