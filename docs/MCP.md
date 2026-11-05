# Shared remote MCP integration

**Mission:** one private Cloudflare D1 memory database used by multiple AI assistants.

**Endpoint:** `https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp`

## Working integrations (November 5, 2026)

| Client | Connection | Live verified behavior |
|---|---|---|
| Claude | Remote MCP, restricted `Authorization: Bearer …` header | Five tools, search/read, submit new and correction proposals, readback after approval |
| ChatGPT | Custom Streamable HTTP MCP, restricted `Authorization: Bearer …` header | Five tools, search/read Claude's approved correction, submit a correction, Claude readback after approval |
| Grok | Custom MCP connector | Not yet connected; see [GROK.md](GROK.md) |
| Gemini | Compatible MCP client | Not yet tested |

The owner verified cross-platform changes using synthetic approved memory ID `c6b82a21-761e-842b-845e-1516025adda5`. ChatGPT submitted proposal `57b7c291-cc87-4bec-8ad5-148239c1adab`; after owner approval Claude read title `MCP Cross-Assistant Integration - Verified` (2026-11-05T05:42:34.581Z). **This proves owner-approved memory sharing and updates in both directions** for those two clients.

## Tools

- `search_memory`: search **approved** memories by text and category.
- `get_memory`: retrieve one **approved** memory by UUID.
- `match_job`: heuristic rank of approved evidence for a job description, not independent validation.
- `propose_memory`: propose a new memory; returns `pending` and `requires_owner_approval:true`.
- `propose_memory_update`: propose replacing an existing record, retaining its UUID if approved; stale versions are rejected.

No MCP tool can approve, reject, archive or directly edit authoritative records. Pending proposals must be reviewed in the owner's private dashboard.

## Authentication

- Existing Claude and ChatGPT clients currently use a **separate restricted agent Bearer token**, not the master owner secret.
- OAuth protected resource metadata, authorization-server metadata, dynamic client registration (DCR), browser owner login and consent, PKCE S256 and one-hour audience/scope-bound access tokens are **deployed and locally tested**.
- Hosted-client OAuth login has **not** been verified. It is not how the two successful integrations authenticated. Grok may need OAuth.
- Anonymous `initialize`, `ping`, `tools/list` may reveal **tool metadata only** for host discovery. Anonymous tool invocation cannot read or write memory; the server returns an OAuth challenge.
- An optional `GET /mcp` or `DELETE /mcp` transport probe receives 405 (POST supported); no public SSE stream is exposed.
- Never put secrets in code, public issues, screenshots, or URL query parameters.

## Verification checklist for additional clients

1. Connect to the same public `/mcp` endpoint using the authentication the client supports.
2. Confirm all five tools are discovered.
3. Call `search_memory("MCP Cross-Assistant Integration")`, then `get_memory` on ID `c6b82a21-761e-842b-845e-1516025adda5`.
4. For a write test, explicitly ask the assistant to submit a synthetic `propose_memory_update` against the same UUID; it must return `pending`.
5. Confirm the approved record is unchanged until the owner approves in the private dashboard. After approval, verify another assistant reads the new text.
6. Record successes and failures separately for each client.

See [Grok](GROK.md), [cross-assistant update examples](CROSS_ASSISTANT_UPDATES.md), [OAuth requirements](OAUTH_REQUIREMENTS.md), [Security](SECURITY.md).
