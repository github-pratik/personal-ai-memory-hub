# Shared remote MCP integration

## Purpose

**One private MCP server serves multiple AI assistants.** Never create separate memory databases for ChatGPT, Claude, Grok or Gemini.

**Live endpoint:**

```text
https://personal-ai-memory-hub.p-pshpatil.workers.dev/mcp
```

The Worker is deployed. **Claude has been verified by the owner** to discover the original three tools and successfully call `search_memory` with `query: "Python"`; the expected response was `{"items":[]}`. Claude has also discovered all five tools and submitted synthetic proposal `ce7f0252-848a-45f7-a0d5-53acc4bb8e45` with `pending` status. This is an owner-reported integration result, not an independently queried production DB. Other clients have not been verified.

## Current MCP implementation

- HTTPS JSON-RPC endpoint, advertising MCP protocol version `2025-06-18`.
- Implemented methods: `initialize`, `ping`, `tools/list`, `tools/call`, `notifications/initialized`.
- Authentication: `Authorization: Bearer <MEMORY_AGENT_TOKEN>`, or owner credential. **Use the dedicated agent token for external assistants, never the owner key.**
- Read-only tools:
  1. `search_memory`: search approved memories by text/category; include evidence source.
  2. `get_memory`: retrieve an approved record by UUID.
  3. `match_job`: return evidence ranked against a job description.
- **Pending proposal only**:
  4. `propose_memory`: submit a proposed fact containing `title`, `body`, `category`, and `source`, only upon a user's explicit request. The server validates input, labels its source as an AI suggestion, checks the pending queue limit (100), and responds with `status: "pending"` and `requires_owner_approval: true`. It does **not** add an approved memory.

  5. `propose_memory_update`: suggest a complete replacement for an existing approved record identified by `memory_id`. The original `updated_at` version is captured. The owner can approve or reject the correction in the dashboard. Stale corrections fail with a conflict instead of replacing newly edited facts.

An agent's token has narrower permissions than the owner. MCP cannot directly approve, edit, archive or delete approved memories. The owner reviews proposals in the private dashboard, where they can approve or reject them. Pending proposals are not returned by `search_memory` or `get_memory` until approved.

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
5. Continue Claude testing (`match_job`, `propose_memory`, owner-only approval constraints) and validate Grok, ChatGPT, and Gemini **separately**, documenting actual outcomes.

Never share tokens or sensitive response payloads in public issues, commit history, or screenshots.

## Known interoperability gaps

- OAuth authorization server, discovery metadata, consent, access/refresh tokens and user-scoped clients are not implemented.
- Full MCP Streamable HTTP behavior and compatibility with each hosted AI client are not independently proven.
- Cloudflare Access Email OTP is a **browser-login** option, not a general OAuth replacement for MCP clients.
- The official Cloudflare **management MCP** in `.mcp.json` is different from our Memory Hub **memory MCP**.

See [Security](SECURITY.md), [Grok setup](GROK.md), [STATUS](STATUS.md).

## Verifying the proposal tool safely

1. Deploy the newest commit using **a new** GitHub Actions workflow run; rerunning old jobs deploys old source.
2. In Claude, confirm `propose_memory` appears in the connector's tool list.
3. Explicitly ask Claude to submit a **clearly synthetic test proposal**, not a real personal fact. Include a source like `Synthetic user test request`.
4. Confirm the response says `pending` and `requires_owner_approval: true`.
5. Confirm the proposed memory is **absent** from approved-memory searches but visible in the dashboard's **Proposed memories** section.
6. Reject the synthetic proposal using the private dashboard. Confirm the approved memory store remains unchanged.

Do not give an AI client your dashboard owner token. The agent may **submit proposals**, but it may not approve them. Model-generated text is an untrusted suggestion until the owner confirms it.

## Job applications and resume guideline updates

Use `search_memory` before proposing a change. Use `propose_memory` for new records and `propose_memory_update` for corrections to the existing record. For now, job applications use category `other` and titles beginning `Job application:`; resume rules use category `preference`. See [cross-assistant updates](CROSS_ASSISTANT_UPDATES.md). These are provisional conventions, not a fully structured application tracking table.
