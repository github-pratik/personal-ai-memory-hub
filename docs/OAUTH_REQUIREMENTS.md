# Product requirements and MCP OAuth acceptance criteria

Reviewed against the MCP 2025-11-25 authorization specification and OpenAI's plugin authentication documentation on November 5, 2026.

## Main user outcome

A user can connect multiple AI assistants to **one private memory database** and:
- retrieve the same owner-approved memories from any connected assistant;
- ask any connected assistant to **propose** a new memory, such as a job application or resume rule;
- ask any connected assistant to **propose a correction** to an existing record, such as a changed application status or corrected resume formatting rule;
- explicitly approve/reject proposals in the owner-only dashboard;
- read the approved result from other assistants without copying it between platforms.

**Non-negotiable:** no AI client may automatically approve or overwrite trusted information. Owner and agent authentication must remain distinct. Private records and tokens must never enter public source control.

## OAuth delivery requirements

1. Serve protected resource metadata at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`.
2. Return `WWW-Authenticate: Bearer resource_metadata=...` on unauthenticated MCP requests.
3. Serve authorization server metadata at `/.well-known/oauth-authorization-server`, with discovery, `S256`, public client `none` and a dynamic registration URL.
4. Support safe OAuth Dynamic Client Registration (DCR); use exact redirect matching, only HTTPS and loopback HTTP callbacks, reject client secrets and cap registrations. CIMD is **not yet supported**.
5. Authorize by logging in as the Memory Hub owner and manually granting a client scopes and its displayed redirect. Never send the owner password to a third-party client.
6. Enforce `authorization_code` + `S256` PKCE, single-use five-minute codes, strict client and redirect binding, resource indicator in both authorization and token exchange, and response `iss` matching advertised issuer.
7. Store **hashed** access tokens and codes, not plaintext. Issue one-hour access tokens scoped to the MCP resource and permissions. Enforce expiry and scope on every MCP request.
8. Support both `memory:read` and `memory:propose`; neither scope may grant owner approval. Preserve existing fixed Bearer agent-token behavior for Claude.
9. Enforce HTTPS in production, secure owner sessions, same-origin form protection, and no token in URL/query.
10. Include a test for: metadata; 401 challenge; invalid registration; login/consent; code exchange; wrong verifier; wrong audience; replay; OAuth MCP request; refusal of owner-only REST; old Bearer compatibility.

## Features that remain outside initial OAuth delivery

- Refresh-token rotation and token revocation UI (access tokens currently expire after one hour and require new owner login/consent after expiry).
- CIMD/client metadata URL validation and private-key JWT clients.
- Multi-user accounts, per-user memory isolation, fine-grained per-client quotas, audit review, account linking UX.
- Structured application-tracker schema. Until implemented, a job application is an approved `other` memory titled `Job application: ...`, and resume policies use `preference`; corrections target the same existing UUID.
- Actual ChatGPT and Grok end-to-end connection tests: these require user-side app connection after Cloudflare deploy.

## Current release checklist

- [x] Existing archived-memory approval error diagnosed and explicit owner recovery implemented with regression tests.
- [x] OAuth metadata, DCR, PKCE, consent, access tokens and scoped MCP authorization implemented.
- [x] Unit tests and end-to-end local smoke tests run in GitHub Actions.
- [ ] Deploy current `main` to Cloudflare using a **new** manual workflow run.
- [ ] Complete ChatGPT custom MCP connection with OAuth.
- [ ] Read the already-approved Claude test memory through ChatGPT.
- [ ] Propose a synthetic correction from ChatGPT and approve it from the dashboard.
- [ ] Test Grok separately; reconcile any additional connector-specific OAuth client requirements.
- [ ] Complete independent production security review, token rotation/revocation, and abuse testing before real sensitive data.

## References

- [OpenAI authentication guide](https://developers.openai.com/plugins/build/auth)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [ChatGPT custom MCP connection instructions](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)

## ChatGPT discovery and linking compatibility regression

An MCP host may require anonymous `initialize` and `tools/list` to discover tool metadata and per-tool OAuth requirements before establishing an OAuth session. These methods expose **only public tool schemas and server protocol metadata**. No personal memory, proposal, or private record is returned. Anonymous `tools/call` yields `isError: true` and `_meta['mcp/www_authenticate']` with the protected-resource discovery URL. All authenticated tool execution continues to validate credentials and scope. Test both initial app creation and subsequent OAuth consent; a successful CI test alone does not prove ChatGPT's hosted connector supports the deployment.
