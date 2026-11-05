# Engineering status

Updated: November 4, 2026 (US Eastern).

## Verified

- Cloudflare Worker deployed at https://personal-ai-memory-hub.p-pshpatil.workers.dev.
- Deployment #4 included the login-origin fix and succeeded; owner verified the login and dashboard in a browser.
- Cloudflare D1 migrations applied. Owner key is configured privately.
- Browser dashboard supports approved memory management, proposals, import/export, and job matching.
- MCP endpoint exists at `/mcp` with read-only `search_memory`, `get_memory`, `match_job`, plus newly implemented `propose_memory` and `propose_memory_update`. Both create pending review items only; owner approval of a correction uses a version check. The updated Worker has been deployed successfully. Claude discovered all five tools and submitted a synthetic `propose_memory` record with status `pending` (owner-reported). Live approval/rejection and `propose_memory_update` remain to be tested.
- **Claude live MCP test (reported by owner):** connector discovered the original three tool descriptions, called `search_memory` with `query: "Python"`, and received `{"items":[]}` without an error. This validates that one external AI client can read from the empty approved-memory store; it does not validate all tool calls, writes, or other clients.
- Unit, TypeScript, D1 local migration, and Worker smoke tests passed on the current tested release.

## Main project goal

A **single private source of truth** for ChatGPT, Claude, Grok, Gemini and compatible MCP clients. The browser dashboard supports the same data store. **Cross-assistant interoperability is the primary product priority**; job application evidence retrieval is one use case.

The owner chose to leave production memories empty until integrations are validated.

## Not yet verified / still to do

1. Add a separate restricted `MEMORY_AGENT_TOKEN` to GitHub's `production` environment secrets and run a **new** manual deployment on current `main`. Do not share the owner key.
2. Verify pending synthetic proposal `ce7f0252-848a-45f7-a0d5-53acc4bb8e45` appears in the owner dashboard, then reject it; follow with a full `propose_memory_update` end-to-end review test. Then complete unauthorized access and transport tests.
3. Connect Grok with its custom MCP connector; its current onboarding requested OAuth credentials, which our endpoint does not implement yet. See [Grok setup](GROK.md).
4. Connect Claude, ChatGPT (subject to account support) and Gemini, adapting auth safely where necessary.
5. Enable Cloudflare Access email OTP for browser sign-in (optional, not yet configured).
6. Perform live abuse/security, quota, session, backup and restore testing before adding sensitive data.

Claude is the **first owner-verified integration**. Other assistants are not verified connected. Never disable authentication to bypass connector limitations.

See [MCP integration](MCP.md), [Security](SECURITY.md) and [Grok](GROK.md).

## Cross-assistant update workflows

Supported by code and local tests: proposed new memories, corrections to approved records, owner-side before/after review, rejection and version-checked approval. Job application history and resume guidelines can use categories `other` and `preference` respectively; dedicated structured application status and revision rules remain future work. See [CROSS_ASSISTANT_UPDATES.md](CROSS_ASSISTANT_UPDATES.md).

## Archived-target correction recovery (code change pending deployment)

Correction proposals may reference a memory that was archived after the suggestion was created. The dashboard previously displayed the original via a join without its state and offered an approval action that rejected archived targets. The dashboard now shows the target state and offers a **separate, explicit owner-only Restore archived memory and approve correction** action. Ordinary correction approval still refuses archived and stale records; the recovery operation is transactional and records a revision. Regression test covers archive, normal conflict, restricted-agent refusal, owner recovery, and repeat requests. The exact current state of the owner's production test record has not been independently read.

## November 5, 2026: OAuth interoperability implementation (not yet deployed)

MCP OAuth protected-resource and authorization-server discovery, dynamic client registration, owner login/consent, PKCE S256 code exchange, short-lived scoped access tokens and strict resource binding were added. Existing Claude fixed Bearer-token access is preserved. Automated end-to-end OAuth tests cover successful consent, token exchange, code replay rejection and owner-route isolation. ChatGPT/Grok remain **not connected**, and no OAuth production deployment has been confirmed. Next: new manual Cloudflare deploy, then ChatGPT OAuth connection test and Grok client test. See [OAUTH_REQUIREMENTS.md](OAUTH_REQUIREMENTS.md).

## November 5: ChatGPT connector authentication denial follow-up

The owner successfully deployed the first OAuth implementation at commit `a959d718`, but ChatGPT reported `The MCP server denied access`. Diagnosis against OpenAI's plugin authentication guidance found that initial MCP initialization and schema discovery were previously rejected with HTTP 401 before the assistant could discover tool-level OAuth policies. The code now permits **anonymous MCP initialize, ping and tools/list only** and advertises OAuth2 scopes per tool. Unauthenticated `tools/call` returns a structured `mcp/www_authenticate` challenge; no untrusted call can access or modify private data. OAuth metadata, client registration, signed-in consent and existing Claude headers are preserved. Automated tests verify anonymous discovery, blocked reads/writes, and the browser authorization flow. This is a compatibility hypothesis until redeployed and retested through ChatGPT; do not claim a successful connection yet.
