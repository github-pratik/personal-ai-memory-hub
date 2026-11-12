# Security model and open risks

The repository is **public code only**. Personal memories and credentials stay in Cloudflare D1 and secret stores, never GitHub source, CI logs or public issues.

## Implemented controls

- Protected API calls require strong Bearer credentials; missing or placeholder owner tokens fail closed.
- Owner and agent roles are distinct. MCP permits three read-only retrieval tools and **two proposal-only** write operations. Agents cannot approve or modify trusted memories.
- The browser uses signed, 12-hour, HttpOnly, Secure, SameSite=Strict cookies and checks POST origins.
- Optional Cloudflare Access Email OTP implementation checks a trusted Cloudflare identity and exact allowed email, but the Access policy is not active yet.
- MCP proposal creation reuses the existing memory input validator, prefixes the evidence source with `AI suggestion via MCP:`, and caps the pending review queue at 100 items per proposal type. Corrections additionally store the original `updated_at` snapshot and refuse stale approval.
- Memory proposals require human approval before becoming approved source material; proposed entries are never returned as approved memory.
- Revision records preserve changes; archive rather than silently delete.

## Connecting AI assistants safely

1. Generate a distinct, restricted `MEMORY_AGENT_TOKEN` of at least 32 random characters. Save it in GitHub production environment secrets, not in source.
2. Never enter `MEMORY_API_TOKEN` (the owner key) into Grok, ChatGPT, Claude, Gemini, or untrusted third-party clients.
3. Verify the remote service's authenticated MCP transport and, where needed, implement OAuth. **Never turn off authentication** to make a connection work.
4. Test a client with **empty** memories first, verify anonymous requests fail and MCP writes only to pending new/correction proposal queues, never to approved memories.
5. Treat all prompt inputs and AI suggestions as untrusted. Never automatically approve new evidence.
6. Review any Cloudflare Access policy changes that could block machines or expose other endpoints.

## Outstanding risks

Third-party connector auth compatibility; production OAuth user-flow review, one-hour token expiry without refresh, public DCR registration quota exhaustion, owner-wide token revocation abuse mitigation; rate limiting, key rotation, token leakage/replay, quotas and resource exhaustion, backups and restoration, prompt injection and proposal spam, production traffic monitoring, browser CSRF edge cases, and multi-user isolation (not implemented).

Before adding private facts, complete live auth tests, an independent security review and backup/recovery validation.

**Never paste secrets into chats, screenshots, logs or code.**

### Archived memory corrections

Ordinary correction approval refuses archived memories. In the dashboard, an archived target is explicitly labeled **Archived target** and normal approval is replaced with the owner-only **Restore archived memory and approve correction** action. That distinct action intentionally reactivates the archived memory, applies the reviewed correction in a D1 transactional batch, and appends a revision. It must never be triggered by an MCP agent, a normal approval, or without an explicit owner click. Stale approved records are still blocked and require a fresh proposal.

## OAuth experimental integration (code committed, deployment pending)

- Public DCR uses fixed 100-client registration quota and strict HTTPS/loopback-HTTP redirect allowlisting. Registration is intentionally public for client interoperability, so rate limiting and abuse mitigation remain outstanding.
- Owner consent requires a signed session obtained by the owner's access key. The UI shows the registered client name, redirect destination and requested permissions before issuing a code. No assistant receives the owner's key.
- Authorization codes expire after five minutes and are bound to the client, exact callback URI, OAuth resource and PKCE S256 challenge. Reuse is rejected.
- Bearer access tokens are random, SHA-256-hashed at rest, audience-bound to `/mcp`, scope-checked, and expire after one hour. No refresh tokens exist. The dashboard provides an emergency owner-key-session control to revoke all OAuth sessions; Cloudflare Access identity alone cannot use it. An emergency owner-only `POST /oauth/owner/revoke-all` endpoint invalidates all OAuth access tokens and outstanding authorization codes; it requires a valid signed owner session and same-origin POST. It does not revoke static owner or agent Bearer keys. The dashboard exposes this endpoint only for signed owner-key sessions; the action does not revoke static credentials. OAuth clients can revoke a token they possess through the client-bound `/oauth/revoke` endpoint (RFC 7009-style), which deletes its hash and returns the same response for unknown tokens.
- Legacy agent Bearer authentication is preserved; OAuth access tokens cannot access owner-only REST/dashboard endpoints.
- **This does not certify production security.** Do not import sensitive personal records until real-client integration and independent security/abuse reviews pass.
