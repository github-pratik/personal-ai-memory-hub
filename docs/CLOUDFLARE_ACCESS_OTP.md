# Cloudflare Access Email OTP (browser login)

**Implementation status:** code and security tests prepared. **Not enabled in Cloudflare yet.** A Cloudflare account owner must configure an Access policy because the existing deployment token only has Workers/D1 permissions.

## Why Cloudflare Access

Cloudflare Access can authenticate a person **before requests reach the Worker**. The Worker reads the authenticated identity from Cloudflare's `ctx.access` runtime context, rather than trusting an email header or accepting user-supplied JWT text.

Official docs: https://developers.cloudflare.com/workers/configuration/cloudflare-access/

This protects the browser and all Worker routes against anonymous traffic, including the private API. A separate MCP/API client may need a Cloudflare Access service-token policy or OAuth integration and must still carry its independent Memory Hub API token. Access does not by itself make ChatGPT/Gemini/Grok clients compatible.

## Setup after a successful basic Cloudflare deployment

1. In Cloudflare, enable **Zero Trust** on your free account if not already enabled, without upgrading to paid services.
2. Open **Workers & Pages**, select the `personal-ai-memory-hub` Worker.
3. Open its **Access** tab, select **Protect this Worker behind Access**.
4. Select **All traffic** (production and previews), not previews only. Verify the exact Worker.
5. Under authentication policy, allow **only your specific email address**. Do not use `Everyone` or a broad email domain unless intentionally shared.
6. Configure the **One-time PIN / email code** identity provider in Zero Trust, if not already selected. Verify the OTP login flow works.
7. In GitHub → repository Settings → Environments → `production`:
   - Add **environment secret** `ACCESS_ALLOWED_EMAIL` with the same authorized email (do not commit your personal email to the public repository).
   - Add **environment variable** `ACCESS_REQUIRED` set to `true`.
8. Run the manual deployment workflow on `main`.
9. Sign in from an incognito browser window. Confirm an unapproved email is blocked, approved email receives OTP, and browser dashboard loads without the old password prompt.
10. Verify backup export and the job matching form while authenticated.

When `ACCESS_REQUIRED=true`, the Worker refuses browser requests unless `ctx.access` exists and `getIdentity().email` matches `ACCESS_ALLOWED_EMAIL`. Browser requests do **not** use `MEMORY_API_TOKEN` in this mode. Do not remove `MEMORY_API_TOKEN`: the application still needs it for internal owner API calls. Cloudflare Access also has to be enabled on the Worker itself, not just in GitHub.

The logout control links to `/cdn-cgi/access/logout`, as documented by Cloudflare. This can terminate the Cloudflare Access session.

## Safety and rollback

- Keep `ACCESS_REQUIRED` **unset** until the Access policy is active and tested. The existing password-only dashboard remains available before cutover.
- Changes to the GitHub variable alone do not change a deployed Worker; a deployment is required.
- To disable Access mode after enabling it, both the Access Worker secret `ACCESS_REQUIRED` and the Access policy must be changed deliberately. Simply removing the GitHub variable may leave the existing deployed secret in place.
- Do **not** store email-OTP codes or access JWTs in the public repository, logs or issues.
- The Cloudflare Access management API needs additional authorization beyond our existing Workers Scripts/D1 token. Do not expand a deployment token's scope automatically.
- A client reaching a domain not protected by the intended Worker Access policy cannot pass the browser identity check when `ACCESS_REQUIRED=true`.
- Usage remains subject to Cloudflare Zero Trust free-tier conditions, which may change.

## Authentication layers

| Client | Guard |
|---|---|
| Browser dashboard | Cloudflare Access OTP with exact email + `ctx.access` (when enabled) |
| Direct REST API | Cloudflare Access ingress + separate owner or agent Bearer token |
| Memory Hub MCP | Cloudflare Access ingress + separate agent Bearer token; client compatibility pending |
| GitHub CI/CD | Restricted Cloudflare API token in GitHub environment secrets |

This guide intentionally separates **Cloudflare's management MCP** (`https://mcp.cloudflare.com/mcp`) from **Memory Hub's retrieval MCP** (`/mcp`).
