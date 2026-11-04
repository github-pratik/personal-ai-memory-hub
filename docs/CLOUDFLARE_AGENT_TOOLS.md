# Cloudflare agent tooling

This repository now includes **Cloudflare agent skills** and the official **Cloudflare API MCP endpoint**.

## Installed skill files

The following Cloudflare-maintained skills are checked into the repository under `.agents/skills/` so compatible coding agents can use them when working in this project:

- `wrangler`: project CLI, D1 migrations and Worker deployment.
- `workers-best-practices`: security, configuration, runtime and APIs. Relevant reference files are included.
- `agents-sdk`: future Cloudflare-native agent patterns. **Not a runtime dependency**.

Upstream source: https://github.com/cloudflare/skills, Apache-2.0 licensed. Source snapshot reviewed on November 4, 2026 (commit `1f2cd0a19588e2c6197c91dd7c71729df1fb6156`).

These are instruction documents for coding agents, **not libraries installed into the deployed Worker**. Our application does not need a new `npm` package or cloud service for these skills.

## Configured Cloudflare management MCP

`.mcp.json` contains the official remote MCP configuration:

```json
{
  "mcpServers": {
    "cloudflare": {
      "type": "http",
      "url": "https://mcp.cloudflare.com/mcp"
    }
  }
}
```

This is Cloudflare's **account-management MCP**, not the Memory Hub's own `/mcp` memory retrieval endpoint. It enables supported coding agents to inspect/deploy Worker resources **only after you authorize Cloudflare OAuth**.

The MCP server is hosted by Cloudflare; we do not need to run `cloudflare/mcp` as another paid service.

## Connecting your coding agents

- **Claude Code**: open project and use the MCP configuration supported by your Claude Code version, or install Cloudflare's full plugin via `/plugin marketplace add cloudflare/skills` and `/plugin install cloudflare@cloudflare`. Authenticate with Cloudflare when prompted.
- **OpenAI Codex CLI**: Cloudflare recommends `codex plugin marketplace add cloudflare/skills` followed by `codex plugin add cloudflare@cloudflare`. Restart the Codex session and authorize Cloudflare OAuth.
- **Cursor**: use its Cloudflare plugin or a remote GitHub rule pointing to `cloudflare/skills` and configure the MCP URL in Cursor's MCP settings. Authorize the Cloudflare account.
- **Other MCP-capable clients**: add `https://mcp.cloudflare.com/mcp` as a remote HTTP MCP server and complete Cloudflare OAuth.

Agent-specific availability varies. Checking `.mcp.json` into GitHub **does not automatically install the server in this ChatGPT conversation** or grant the agent Cloudflare access. The owner must connect their Cloudflare account in whichever coding agent is actually executing deployment operations.

## Security and cost controls

1. Prefer the Cloudflare OAuth browser authorization flow. Never put tokens in `.mcp.json`, commits, public issues or messages.
2. Grant least-privilege Cloudflare scopes. Review any permission escalation.
3. Keep the existing Workers + D1 free-tier budget, and confirm the free tier before provisioning resources.
4. Do not publish personal job-search memories, imported career data or resumes to GitHub.
5. The Cloudflare management MCP can mutate infrastructure, so do not attach it to untrusted agent prompts with unlimited privileges.
6. The Cloudflare skills repository is maintained separately and should be updated only after reviewing upstream changes and retesting the application.

## Manual hosted deployment

See [Deployment](DEPLOYMENT.md). Our current GitHub Actions deployment requires separately supplied Cloudflare credentials; simply adding an MCP configuration does not deploy an application.
