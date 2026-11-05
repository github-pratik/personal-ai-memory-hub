# Shared remote MCP integration

## Purpose

**One private MCP server serves multiple AI assistants.** Never create separate memory databases for ChatGPT, Claude, Grok or Gemini.

**Live endpoint:**

```text
https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp
```

The Worker is deployed. **Claude has been verified by the owner** to discover all three tools and successfully call `search_memory` with `query: "Python"`; the expected response was `{"items":[]}`. Other clients have not been verified. The memory store is deliberately empty while integration is tested.

## Current MCP implementation

- HTTPS JSON-RPC endpoint, advertising MCP protocol version `2025-06-18`.
- Implemented methods: `initialize`, `ping`, `tools/list`, `tools/call`, `notifications/initialized`.
- Authentication: `Authorization: Bearer <MEMORY_AGENT_TOKEN>`, or owner credential. **Use the dedicated agent token for external assistants, never the owner key.**
- Read-only tools:
  1. `search_memory`: search approved memories by text/category; include evidence source.
  2. `get_memory`: retrieve an approved record by UUID.
  3. `match_job`: return evidence ranked against a job description.

An agent's token has narrower permissions than the owner. MCP cannot approve, edit or archive memories.

## Client compatibility checklist

| Assistant | Integration target | State |
|---|---|---|
| Grok | Custom MCP connector | Not tested yet; [setup](GROK.md) |
| ChatGPT | Custom MCP integration, subject to account/workspace and auth support | Not tested |
| Claude | Custom remote MCP connector with restricted `Authorization` request header | **Tool discovery + `search_memory` succeeded (owner-reported)** |
| Gemini | Compatible MCP runtime/adapter | Not tested |
| MCP developer client | HTTP with fixed Bearer authorization | Next verification target |

**Do not assume** any web connector accepts an arbitrary fixed `Authorization` header. Hosted clients may require OAuth. Where required, add secure OAuth support rather than exposing the data anonymously or placing secrets in the URL.

## Safe test plan

1. Add a separate strong `MEMORY_AGENT_TOKEN` to GitHub's `production` environment secrets.
2. Start a **new** Cloudflare deployment on current `main`. Verify the secret-configuration step succeeded.
3. Use a trusted MCP client that can set an Authorization Bearer header and test `initialize`, `tools/list`, and `search_memory`.
4. Empty memory results are expected. Test no-token requests return HTTP 401 and agents cannot mutate approved records.
5. Continue Claude testing (`match_job`, read-only constraints) and validate Grok, ChatGPT, and Gemini **separately**, documenting actual outcomes.

Never share tokens or sensitive response payloads in public issues, commit history, or screenshots.

## Known interoperability gaps

- OAuth authorization server, discovery metadata, consent, access/refresh tokens and user-scoped clients are not implemented.
- Full MCP Streamable HTTP behavior and compatibility with each hosted AI client are not independently proven.
- Cloudflare Access Email OTP is a **browser-login** option, not a general OAuth replacement for MCP clients.
- The official Cloudflare **management MCP** in `.mcp.json` is different from our Memory Hub **memory MCP**.

See [Security](SECURITY.md), [Grok setup](GROK.md), [STATUS](STATUS.md).
