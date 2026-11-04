# Security model and open risks

- **Public repository:** code and docs only. Personal data lives in private cloud database.
- **Fail closed:** `MEMORY_API_TOKEN` must be a configured strong secret; an absent/placeholder token rejects all protected requests.
- **No secret in frontend:** Browser access requires a server-side session/OAuth; do not embed the API token into JS, static assets or localStorage.
- **No AI-controlled approvals:** proposed memory facts should remain pending until explicit user review.
- **Auditability:** revisions preserve historical values; archive instead of silent deletion.
- **Access:** current code supports a single authenticated user/service credential. Multi-user/tenant access is not implemented.
- **Threats to address before deployment:** bearer-token leakage/replay, rate limiting, OAuth state/CSRF, credential rotation, authorization scope, security headers, backup encryption, concurrency, D1 quota exhaustion, model prompt injection.
- **Data export:** personal data must be excluded from CI logs, screenshots, issues and bug reports.

A full security review, abuse tests and threat model are required before connecting real personal memory.
