# Remote MCP integration (early prototype)

**Endpoint:** `POST https://<worker>.workers.dev/mcp`

**Auth:** `Authorization: Bearer <MEMORY_AGENT_TOKEN>` (or owner token). Configure a separate token for read-only client access rather than sharing the owner login secret. Never put tokens in public GitHub files or screenshots.

Supported JSON-RPC methods:
- `initialize`
- `ping`
- `tools/list`
- `tools/call`
- `notifications/initialized`

Read-only tools:
1. `search_memory` — find approved memories by keyword with sources.
2. `get_memory` — retrieve one approved memory.
3. `match_job` — rank relevant approved memories against a job description.

The MCP endpoint cannot create, edit, archive, approve or reject memories. A separate agent-scoped REST endpoint may submit **pending** proposals.

**Limitations:** OAuth authorization metadata, interactive OAuth authorization and cross-provider connection testing are not yet implemented. Some clients require OAuth rather than a manually configured Bearer token, so do not claim universal connectivity until proven.
