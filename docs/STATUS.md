# Engineering status

Updated November 5, 2026 (US Eastern).

## Main product requirement

**One private, user-controlled memory source for ChatGPT, Claude, Grok, Gemini, and other compatible MCP clients.** Any connected assistant can read approved information and, on an explicit user request, submit new memories or corrections for **owner approval**. Core use cases include job application status, resume versions, resume guidelines, project facts and preferences. The dashboard remains the authority for approval/rejection. Cross-assistant interoperability is the primary objective, not a separate database per model.

## Verified in live clients (owner-reported)

- Cloudflare Worker, D1 storage and signed-in private dashboard work.
- MCP has five tools: `search_memory`, `get_memory`, `match_job`, `propose_memory`, and `propose_memory_update`.
- Claude connected with a restricted Bearer Authorization header, discovered all five tools, created a pending memory proposal, and read approved memory after owner approval.
- Claude submitted a correction; a previously archived target triggered a protected approval failure. The explicit owner-only **Restore archived memory and approve correction** recovery worked; the original memory UUID was preserved.
- ChatGPT custom Streamable HTTP MCP connected using a restricted Bearer Authorization header and discovered all five tools. It retrieved the same record previously updated through Claude.
- **Two-way write/read verification:** ChatGPT submitted correction proposal `57b7c291-cc87-4bec-8ad5-148239c1adab` for memory `c6b82a21-761e-842b-845e-1516025adda5`; the owner approved it; Claude retrieved the updated title **MCP Cross-Assistant Integration - Verified**, with `updated_at` `2026-11-05T05:42:34.581Z`. The read was from the same UUID.
- Live unauthenticated probes confirmed health, OAuth discovery endpoints, MCP initialization and tool discovery; tool execution still requires credentials. Local CI, migration, auth, OAuth, owner-approval and regression tests passed.

**Verified pattern:** Claude → owner-reviewed Memory Hub → ChatGPT, and ChatGPT → owner-reviewed Memory Hub → Claude. These are actual owner-reported real-client tool outputs, not merely unit-test results.

## Authentication

- **Working hosted integrations:** restricted agent Bearer header in Claude and ChatGPT.
- **OAuth:** discovery metadata, dynamic public-client registration, owner login/consent, PKCE S256, scoped short-lived access tokens are implemented and deployed. OAuth login has not yet succeeded end-to-end through a hosted client. Access-token refresh/revocation controls, stronger quotas/abuse protection and independent security review remain outstanding.
- MCP anonymous `initialize` and `tools/list` reveal public tool definitions only. Unauthenticated `tools/call` returns an OAuth challenge, not private facts.

## Pending milestones

1. **Grok:** configure the same public `/mcp` URL in its Custom MCP connector, authenticate securely, verify tool listing and retrieval of the existing synthetic memory, then propose a synthetic correction. Grok may require its own OAuth credentials/setup; do not assume it accepts the Claude/ChatGPT custom header workflow.
2. **Gemini:** connect and verify the same read/propose/owner-approval/readback cycle.
3. **First-class job tracking:** dedicated application states, company/role/date, applied resume version and timeline; currently stored as owner-reviewed `other` memories.
4. **Resume guidelines:** structured, non-duplicated owner-reviewed `preference` records.
5. Production security review, auth/secret rotation, rate limits, auditability, backup/restore and token revocation before storing sensitive information.

Never expose personal records or credentials in this public source repository.

See [MCP integration](MCP.md), [Grok connector](GROK.md), [cross-assistant update workflow](CROSS_ASSISTANT_UPDATES.md) and [security](SECURITY.md).
