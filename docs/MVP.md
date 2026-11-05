# Product vision and MVP

## Mission

**One user-controlled, private memory hub for many AI assistants.** The same approved facts should be searchable from ChatGPT, Claude, Grok, Gemini and other compatible clients. Users should not repeatedly re-enter career history, projects or preferences into separate services.

The private dashboard is a management interface. Resume tailoring is an important first use case, **not the entire product**.

## Non-negotiables

- Public repository, private production facts and secrets.
- $0/month hosting target within free-tier limits. No automatic paid LLM calls.
- Owner approves proposed facts before they become trusted evidence.
- Read-only agent retrieval by default; no automatic approval or rewriting.
- Source-aware data, revision history, exports and backups.
- No fabricated jobs, project metrics, qualifications, or experience.
- Separate access levels for owner versus external assistant.

## Shipped in code

1. Cloudflare Workers TypeScript API, D1 database and migrations.
2. Signed-session private browser dashboard, memory CRUD/archive and versioning.
3. Proposed fact approval queue, import and backup export.
4. Keyword-based resume/job evidence matching.
5. Authenticated JSON-RPC MCP server with three read-only tools plus pending-only `propose_memory` and `propose_memory_update` tools. Approved memories still require owner action.
6. Tests, CI, and manual Cloudflare deployment.

## Current milestone: client interoperability

- Provision a **separate** restricted agent credential.
- Verify `initialize`, `tools/list`, `tools/call` on hosted MCP using a real compatible client.
- Test Grok, Claude, ChatGPT and Gemini individually and document actual auth/transport behavior.
- Where necessary, implement standards-compliant OAuth, compatibility features and secure scopes.
- Verify that clients cannot read without authorization or modify approved facts; `propose_memory` and `propose_memory_update` may only create pending suggestions; corrections require owner approval and reject stale revisions.
- Only then import private personal memories.

## Explicitly not promised

Universal provider support, automatic synchronization of proprietary AI-provider memories, a paid model router, a completed OAuth server, cross-provider agent identity federation, or an independently audited product.

## Release gates

Passing CI and successful Worker deployment alone do not establish secure multi-provider integration. Require authenticated end-to-end tests, rejection of unauthorized calls, source integrity, backup recovery, and quota/security review.

## Primary user journeys

- From any compatible AI assistant: record a job application as a pending memory proposal.
- From any compatible AI assistant: update the status of an existing application using a pending correction proposal.
- From any compatible AI assistant: propose a correction to a resume guideline or personal project fact, preserving approved history.
- Owner reviews and approves or rejects suggestions in the dashboard; all assistants subsequently read the same approved result.

See [cross-assistant update examples](CROSS_ASSISTANT_UPDATES.md).
