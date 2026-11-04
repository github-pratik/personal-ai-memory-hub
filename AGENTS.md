# Agent Operating Instructions

## Mission
Build a user-controlled, secure, zero-cost-target cross-platform memory hub. The public repository must **never** contain personal facts, credentials, employer data, production database dumps or tokens.

## Delivery process
1. Work from a GitHub issue with acceptance criteria.
2. Keep changes small; include automated tests.
3. Run typecheck and tests; do not claim a check passed without evidence.
4. Protect user data. Fail closed on authentication errors.
5. Do not make unnecessary infrastructure additions (Redis, agent frameworks, paid LLMs) without benchmarking.
6. No automatic approval of AI-generated memory facts.
7. No deployment without a secret, access-control review and quota controls.
8. Report progress as completed, verified, blocked, next.

## Agent roles
- **Tech lead/orchestrator:** priorities, reviews, security gates and reports.
- **Backend:** Worker API, validation and data consistency.
- **Data:** D1 migrations, revisions, backups and retrieval.
- **Frontend:** accessible authenticated dashboard.
- **QA/security:** auth bypass tests, database isolation, dependency review and CI.

These are task roles, not evidence that separate processes are currently running.

## Definition of done
Implemented, tested, reviewed, documented and linked to an issue. Mark blocked when credentials or account permissions are required.
