# Engineering status

Updated: November 4, 2026 (US Eastern).

## Verified

- Cloudflare Worker deployed at https://personal-ai-memory-hub.p-pshpatil.workers.dev.
- Deployment #4 included the login-origin fix and succeeded; owner verified the login and dashboard in a browser.
- Cloudflare D1 migrations applied. Owner key is configured privately.
- Browser dashboard supports approved memory management, proposals, import/export, and job matching.
- MCP endpoint exists at `/mcp` with read-only `search_memory`, `get_memory`, `match_job`, plus newly implemented `propose_memory`, which creates pending review items only. Live redeployment and Claude verification of the fourth tool are pending.
- **Claude live MCP test (reported by owner):** connector discovered the original three tool descriptions, called `search_memory` with `query: "Python"`, and received `{"items":[]}` without an error. This validates that one external AI client can read from the empty approved-memory store; it does not validate all tool calls, writes, or other clients.
- Unit, TypeScript, D1 local migration, and Worker smoke tests passed on the current tested release.

## Main project goal

A **single private source of truth** for ChatGPT, Claude, Grok, Gemini and compatible MCP clients. The browser dashboard supports the same data store. **Cross-assistant interoperability is the primary product priority**; job application evidence retrieval is one use case.

The owner chose to leave production memories empty until integrations are validated.

## Not yet verified / still to do

1. Add a separate restricted `MEMORY_AGENT_TOKEN` to GitHub's `production` environment secrets and run a **new** manual deployment on current `main`. Do not share the owner key.
2. Deploy and verify the new `propose_memory` MCP tool from Claude; confirm proposals remain pending until owner approval. Then complete unauthorized access and transport tests.
3. Connect Grok with its custom MCP connector; its current onboarding requested OAuth credentials, which our endpoint does not implement yet. See [Grok setup](GROK.md).
4. Connect Claude, ChatGPT (subject to account support) and Gemini, adapting auth safely where necessary.
5. Enable Cloudflare Access email OTP for browser sign-in (optional, not yet configured).
6. Perform live abuse/security, quota, session, backup and restore testing before adding sensitive data.

Claude is the **first owner-verified integration**. Other assistants are not verified connected. Never disable authentication to bypass connector limitations.

See [MCP integration](MCP.md), [Security](SECURITY.md) and [Grok](GROK.md).
