# Connect Grok to Personal AI Memory Hub

**State (November 5, 2026): Grok not yet verified connected.** ChatGPT and Claude already completed a live two-way memory update/readback cycle with the same D1 database.

## Start here: Grok web connector

1. Open **https://grok.com/connectors** and choose **New Connector → Custom**.
2. Name: **Pratik Personal Memory**.
3. Server URL: `https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp`.
4. Choose automatic OAuth discovery/sign-in if the UI offers it. The Worker already publishes protected-resource and OAuth authorization-server discovery metadata, public client registration (DCR), owner consent, PKCE S256 and a token endpoint. These endpoints are deployed, but Grok's compatibility has **not yet been tested**.
5. If Grok displays an OAuth credentials form demanding **Client ID**, **Authorization Endpoint** and **Token Endpoint** immediately, **do not enter an API token as the Client ID**, invent IDs, or use the owner key. The connector may require a client to be registered before entry. Client registration needs Grok's **exact approved callback/redirect URI**. We must obtain that URI from Grok's setup/docs and register it securely; until then, do not guess it.
6. After authorization, ask Grok to list available tools and call `search_memory` for `MCP Cross-Assistant Integration`, then `get_memory` on `c6b82a21-761e-842b-845e-1516025adda5`. It should return the approved test memory with title `MCP Cross-Assistant Integration - Verified`.
7. To verify writes, explicitly ask Grok to call `propose_memory_update` with a **synthetic** correction. It must stay **pending** until the user approves it in the dashboard. Do not test real career facts yet.

Grok's official [custom MCP connector guide](https://docs.x.ai/grok/connectors) documents the New Connector → Custom entry point and publicly reachable URL; it does **not** promise that the Grok web form accepts arbitrary HTTP Authorization headers. Avoid exposing the server or placing tokens in URLs to work around its authentication requirements.

## MCP tools

- `search_memory`: read approved records by keyword.
- `get_memory`: read one approved record by UUID.
- `match_job`: match approved evidence heuristically.
- `propose_memory`: submit a new untrusted suggestion to owner review.
- `propose_memory_update`: submit a correction to an existing approved record for owner review.

There is **one** Cloudflare Worker and **one** private D1 memory database for ChatGPT, Claude and Grok. No Grok-specific copy is needed. Owner-only approval/rejection is not exposed to Grok.

## Deployed OAuth endpoints (if manual setup is necessary)

| Field | Deployed value |
|---|---|
| MCP URL | `https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp` |
| Authorization server metadata | `https://personal-ai-memory-hub.p-pshpatil.workers.dev/.well-known/oauth-authorization-server` |
| Protected resource metadata | `https://personal-ai-memory-hub.p-pshpatil.workers.dev/.well-known/oauth-protected-resource` |
| Authorization Endpoint | `https://personal-ai-memory-hub.p-pshpatil.workers.dev/oauth/authorize` |
| Token Endpoint | `https://personal-ai-memory-hub.p-pshpatil.workers.dev/oauth/token` |
| Dynamic Client Registration | `https://personal-ai-memory-hub.p-pshpatil.workers.dev/oauth/register` |
| Scopes | `memory:read memory:propose` |
| Auth method | public client `none`, **PKCE S256** |
| Client ID | **Not yet registered for Grok**. Registration must bind Grok's exact callback URI. |
| Client secret | None for a PKCE public client. Do not use the Memory Hub/Cloudflare secrets. |

**Limitations:** OAuth tokens expire after one hour and there is no refresh-token flow or revocation dashboard yet. A real hosted Grok session has not been tested. We must resolve any incompatibility without weakening the private memory boundary.

## Troubleshooting

- **OAuth form cannot discover client:** Grok might not support DCR in its web flow. Obtain its exact callback URI, then register and paste the issued client ID; never fabricate one.
- **401:** absent/expired/incorrect OAuth token or Bearer key.
- **403:** insufficient OAuth scope or wrong role.
- **Tools missing:** verify server URL ends in `/mcp` and the connector is enabled.
- **Owner key / client secret:** never paste into chat, source, screenshots, or URL.
- **Deploying source:** use a **new** GitHub Actions deployment workflow run on current `main`, not a rerun of an old job.

See [MCP.md](MCP.md), [STATUS.md](STATUS.md), [OAUTH_REQUIREMENTS.md](OAUTH_REQUIREMENTS.md) and [SECURITY.md](SECURITY.md).
