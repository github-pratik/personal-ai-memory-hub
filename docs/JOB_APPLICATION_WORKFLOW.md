# Job application workflow: product priority

This project is being built first for **accurate, targeted job applications**.

1. User enters a job description into their private dashboard.
2. System selects **approved** evidence from their experience, projects, education and skills.
3. It distinguishes tool usage from implementation (for example, using Odoo to log time does **not** mean developing Odoo modules).
4. It returns matching memories with source references and dates.
5. User or an authorized assistant drafts a resume with evidence only, not guessed accomplishments.
6. Anything the AI discovers but cannot verify becomes a **pending proposal**, never an approved fact.

## MVP evidence selection
First release ranks memories with deterministic token overlap and category filters. It requires no paid LLM inference. We will later measure whether free embedding providers improve recall. Do not confuse keyword relevance with factual correctness.

## Definition of useful
A user can search terms from a job description, see their best real achievements and retrieve the factual evidence from a different device. They can export and edit memories; agent-submitted proposals require human review.
