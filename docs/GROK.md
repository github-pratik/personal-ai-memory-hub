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

## One-click Grok OAuth Client ID registration

Grok's web connector has previously displayed the **OAuth Credentials Required** form. We added a manual [Register Grok OAuth client](https://github.com/github-pratik/personal-ai-memory-hub/actions/workflows/register-grok.yml) GitHub Actions workflow:

1. Open the workflow, click **Run workflow** on `main`.
2. Open the completed run, expand **Register public PKCE client for Grok web connector** and copy the `GROK_CLIENT_ID` value.
3. In Grok's custom connector, use the MCP URL above and enter the **GROK_CLIENT_ID**. Leave Client Secret empty. Use the authorization and token endpoints listed below; scopes `memory:read memory:propose` if requested; token auth method `none (PKCE only)`.
4. Approve the sign-in from the Memory Hub browser page. Do **not** enter the Memory Hub master access key into Grok itself.
5. Test Grok with a read-only request for the existing synthetic memory.

The workflow registers **only** `https://grok.com/connectors-oauth-exchange-code/`, a callback corroborated by multiple community integration guides. Grok's official connector documentation does not explicitly publish the callback. If Grok sends a different `redirect_uri`, registration must be adjusted to the exact observed URI, not guessed or loosened to a wildcard. The Client ID is a public identifier, **not** a secret; no private token is exposed in logs.

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
| Client ID | Run the [manual Grok registration workflow](https://github.com/github-pratik/personal-ai-memory-hub/actions/workflows/register-grok.yml) and copy its `GROK_CLIENT_ID` output; client registration is required before filling this field. |
| Client secret | None for a PKCE public client. Do not use the Memory Hub/Cloudflare secrets. |

**Limitations:** OAuth tokens expire after one hour and there is no refresh-token flow or revocation dashboard yet. A real hosted Grok session has not been tested. We must resolve any incompatibility without weakening the private memory boundary.

## Recommended Grok endpoint (November 5 update)

**Use `https://personal-ai-memory-hub.p-pshpatil.workers.dev/grok/mcp` for Grok, not the generic `/mcp`.** The generic endpoint intentionally permits unauthenticated tool *discovery* for compatibility, which caused Grok to show Connected without starting OAuth. The new Grok-only path immediately challenges every unauthenticated request with HTTP 401 and points to its path-specific protected resource metadata (`/.well-known/oauth-protected-resource/grok/mcp`). After a successful OAuth sign-in it exposes the same five tools and the same D1 database. Existing Claude and ChatGPT clients stay on `/mcp`.

The OAuth server also accepts Grok's **publicly published OAuth client identifier** `https://grok.com/oauth/mcp-client.json` as a pinned, preconfigured public client. Only the exact published Grok and xAI console redirect URLs are accepted. Private keys are never sent to Grok. No Grok client ID registration workflow is needed for this identity.

To test: deploy the latest `main` manually, disconnect the previously misidentified Grok custom connector, create a new custom connector with the **/grok/mcp** URL, finish owner sign-in/consent, then call `search_memory`. The previous `/mcp` connector may continue to say Connected without authentication; do not reuse it. Live sign-in and readback are **not yet verified**.


## Troubleshooting

- **OAuth form cannot discover client:** Grok might not support DCR in its web flow. Obtain its exact callback URI, then register and paste the issued client ID; never fabricate one.
- **401:** absent/expired/incorrect OAuth token or Bearer key.
- **403:** insufficient OAuth scope or wrong role.
- **Tools missing:** verify server URL ends in `/mcp` and the connector is enabled.
- **Owner key / client secret:** never paste into chat, source, screenshots, or URL.
- **Deploying source:** use a **new** GitHub Actions deployment workflow run on current `main`, not a rerun of an old job.

See [MCP.md](MCP.md), [STATUS.md](STATUS.md), [OAUTH_REQUIREMENTS.md](OAUTH_REQUIREMENTS.md) and [SECURITY.md](SECURITY.md).

## November 5, 2026: missing sign-in prompt fix

Grok previously showed **Connected** and discovered the five tools but then reported **Authentication is required** when invoking `search_memory`, without opening the owner sign-in page. The server used to return HTTP 200 with a JSON-RPC authentication error on unauthenticated `tools/call`, which is **not** the MCP OAuth HTTP transport challenge. The handler has been corrected to send HTTP **401 Unauthorized** with `WWW-Authenticate: Bearer resource_metadata="https://personal-ai-memory-hub.p-pshpatil.workers.dev/.well-known/oauth-protected-resource"` and an invalid-token error. Public schema discovery remains intact; unauthenticated reads/writes stay forbidden. Automated tests pass, but Grok sign-in is still **not** verified until new code is deployed and tested.

After deploying the latest code via a new workflow run, try calling `search_memory` in Grok again. If Grok opens the Memory Hub consent screen, finish owner sign-in there. If it still displays only **Connected** with an authentication-required card, collect the exact error and investigate whether Grok's hosted connector attempts OAuth discovery, registration, or token exchange. Do not disable authentication.
