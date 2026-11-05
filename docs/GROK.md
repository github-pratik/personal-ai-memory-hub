# Connect Grok to Personal AI Memory Hub

## Integration state

The Memory Hub MCP endpoint is deployed, but a live Grok connection and tool-call test **have not been completed**. Grok documents custom MCP connectors at https://docs.x.ai/grok/connectors and provides a connection UI at https://grok.com/connectors.

**Use the same server URL for every compatible MCP client:**

```text
https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp
```

No Grok-specific Worker or separate database is necessary. This endpoint already implements `initialize`, `tools/list`, `tools/call`, `ping` and `notifications/initialized`, plus the read tools `search_memory`, `get_memory`, `match_job`, and the pending-only `propose_memory` tool after the updated Worker is deployed.

## Configure securely

1. In GitHub **Settings → Environments → production → Environment secrets**, add a randomly generated, **separate** `MEMORY_AGENT_TOKEN` (32+ characters). Never use the dashboard owner key in an AI client.
2. From **Actions → Deploy to Cloudflare (manual, free-tier only)**, run a **new** workflow on `main`. The optional agent credential is applied only when the workflow receives this secret.
3. Visit https://grok.com/connectors → **New Connector → Custom**.
4. Set the server URL above. Configure authentication as supported by the current Grok connector UI. The Memory Hub currently expects `Authorization: Bearer <MEMORY_AGENT_TOKEN>` on `/mcp`. Do not type the secret into a public GitHub page or paste it into chat.
5. Discover the tools, and test a **read-only** call. With an empty database, searches should return an empty list, not unrelated or invented personal facts.
6. Confirm Grok cannot create or approve an **approved** memory via MCP. `propose_memory` can only create an unapproved pending proposal.

**Compatibility note:** Grok supporting *custom MCP* does **not** prove that its hosted connector UI supports the exact fixed Bearer-header authorization used by this MVP. If Grok's offered authentication differs, stop and implement an appropriate OAuth flow or other secure bridge instead of removing API authentication or embedding a token in the URL. A self-hosted MCP client with configurable headers can be used to test the endpoint separately.

**Never make `/mcp` public without authentication to simplify onboarding.** Empty memory today is not a security guarantee for the future.

## What Grok can do once connected

- `search_memory` — search owner-approved professional facts by keyword and category.
- `get_memory` — retrieve a specific approved fact with its source.
- `match_job` — rank approved evidence for a job description.
- `propose_memory` — submit a user-requested memory suggestion to owner review; cannot approve it.

All searches read the same Cloudflare D1 database used by the browser dashboard and other assistants.

## Troubleshooting

- **401 Unauthorized:** missing/incorrect Bearer token or agent secret not deployed.
- **403 Forbidden:** the token is authenticated but lacks permission, or Cloudflare Access policy blocks the client.
- **Tool discovery fails:** verify MCP HTTP transport, methods and authorization support. Do not assume Grok supports custom headers until its UI confirms.
- **No results:** an empty database is expected during setup.
- **Deploy has the old behavior:** run a **new** workflow on current `main`; `Re-run all jobs` on a previous run redeploys its original commit.

See [MCP.md](MCP.md), [STATUS.md](STATUS.md), and [SECURITY.md](SECURITY.md).

## OAuth implementation update (requires deployment and live test)

The Memory Hub source now includes OAuth authorization server metadata, dynamic client registration, owner-consented authorization code + PKCE, and a token endpoint. After deploying current `main`, retry the same MCP URL. Grok's connector may request a client ID and explicit endpoint configuration; the exact client onboarding behavior must be verified in Grok. No successful Grok OAuth connection has been established yet. Consult [OAuth requirements](OAUTH_REQUIREMENTS.md); never substitute owner/Cloudflare tokens for OAuth client credentials.
