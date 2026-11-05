# Security model and open risks

The repository is **public code only**. Personal memories and credentials stay in Cloudflare D1 and secret stores, never GitHub source, CI logs or public issues.

## Implemented controls

- Protected API calls require strong Bearer credentials; missing or placeholder owner tokens fail closed.
- Owner and agent roles are distinct; MCP offers only read-only retrieval tools.
- The browser uses signed, 12-hour, HttpOnly, Secure, SameSite=Strict cookies and checks POST origins.
- Optional Cloudflare Access Email OTP implementation checks a trusted Cloudflare identity and exact allowed email, but the Access policy is not active yet.
- Memory proposals require human approval before becoming approved source material.
- Revision records preserve changes; archive rather than silently delete.

## Connecting AI assistants safely

1. Generate a distinct, restricted `MEMORY_AGENT_TOKEN` of at least 32 random characters. Save it in GitHub production environment secrets, not in source.
2. Never enter `MEMORY_API_TOKEN` (the owner key) into Grok, ChatGPT, Claude, Gemini, or untrusted third-party clients.
3. Verify the remote service's authenticated MCP transport and, where needed, implement OAuth. **Never turn off authentication** to make a connection work.
4. Test a client with **empty** memories first, verify anonymous requests fail and no write operations exist on MCP.
5. Treat all prompt inputs and AI suggestions as untrusted. Never automatically approve new evidence.
6. Review any Cloudflare Access policy changes that could block machines or expose other endpoints.

## Outstanding risks

Third-party connector auth compatibility; OAuth/authorization scope and refresh; rate limiting, key rotation, token leakage/replay, quotas and resource exhaustion, backups and restoration, prompt injection, production traffic monitoring, browser CSRF edge cases, and multi-user isolation (not implemented).

Before adding private facts, complete live auth tests, an independent security review and backup/recovery validation.

**Never paste secrets into chats, screenshots, logs or code.**
