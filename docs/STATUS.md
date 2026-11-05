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
