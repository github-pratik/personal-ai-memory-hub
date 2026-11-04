# Deploy the Personal AI Memory Hub ($0 target)

The code is ready to run locally and has an automated, **manual-release** Cloudflare deployment workflow. It is **not deployed yet**. The owner must authorize a Cloudflare account once, because repository write access does not grant hosting access.

## Required one-time owner authorization

1. Use a personal Cloudflare account on its free tier; confirm no paid resources are enabled.
2. In Cloudflare, create a D1 database named `memory-hub`. Copy its database ID.
3. Create a Cloudflare API token with the minimum permissions required for Workers deployment and D1 migrations. Do **not** post the token in chat, an issue, or a commit.
4. In GitHub, configure the repository's `production` environment and these **environment variables**:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`
5. Configure these **GitHub Actions secrets**:
   - `CLOUDFLARE_API_TOKEN`
   - `MEMORY_API_TOKEN`: a randomly generated secret with at least 40 characters; used for private owner login.
   - `MEMORY_AGENT_TOKEN`: optional independent randomly generated secret for read-only memory/MCP access and proposals.
6. Run **Actions → Deploy to Cloudflare → Run workflow** only after reviewing the linked CI checks and security notes.

The deployment workflow migrates D1, deploys the Worker and sets Worker secrets. The public `/health` route contains no personal information. The dashboard and private endpoints deny access until authentication is configured.

## After deployment

- Open the reported `workers.dev` URL over HTTPS.
- Sign in with the owner access key. Do **not** paste the key into screenshots, issues or logs.
- Test a synthetic memory and a JSON backup export before entering any personal facts.
- Import up to 25 verified memories at a time using the private dashboard.
- Paste a job description in the dashboard to retrieve ranked approved evidence.
- Rotate any disclosed secret immediately in GitHub and Cloudflare.

## What is not solved yet

- Social OAuth sign-in and production-ready user lifecycle.
- Verified native connections to ChatGPT, Claude and Grok. The Bearer-authenticated MCP endpoint is a technical base; client-specific auth support must be tested.
- Automated quota alerts, backup restoration, and security review.
- Provider free tiers have limits and may change. Deployment at $0 is a target, never a guarantee.
