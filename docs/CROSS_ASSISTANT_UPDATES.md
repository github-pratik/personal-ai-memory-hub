# Updating personal memory from any AI assistant

**Product requirement:** connected assistants should not just read memory. On explicit user request, they should be able to **suggest new records and corrections**, while the owner controls what becomes the shared source of truth.

## Shared workflow

1. User tells ChatGPT, Claude, Grok, or another connected assistant: "I applied to this job", "Use this resume formatting rule", or "Correct this fact."
2. Assistant searches the existing approved memory first to avoid duplicates and selects the correct record.
3. For a new fact, call `propose_memory`. For a correction to an approved existing record, call `propose_memory_update` with the original `memory_id` and complete corrected fields.
4. The API responds `status: pending`, `requires_owner_approval: true`. **This is not a saved approved memory.**
5. In the owner's private dashboard, review the proposed entry or side-by-side original and replacement, then approve or reject.
6. On approval, the same approved facts are available to every connected assistant on subsequent searches.

**Current release behavior:** the tools submit proposals only. Automatic trusted-memory updates are intentionally forbidden. Real-client verification of the new write tools remains pending until deployment.

## Example: job application

User says: "Save that I applied for Associate AI Engineer at ExampleCorp on November 4, 2026. Status: applied. Resume version: AI Engineer v3."

Assistant checks for an existing entry for that company and role. If none, it calls:

```json
{
  "name": "propose_memory",
  "arguments": {
    "title": "Job application: ExampleCorp — Associate AI Engineer",
    "body": "Applied: 2026-11-04. Status: applied. Resume version: AI Engineer v3. Application reference: not supplied.",
    "category": "other",
    "source": "User explicitly confirmed in current conversation"
  }
}
```

If the user later says "I got an interview", the assistant searches the approved entry, then calls `propose_memory_update` with its `memory_id` and the full corrected record, preserving application date and resume version.

For this MVP, job applications are stored as category `other` with titles beginning `Job application:`. A future dedicated job applications data model will add first-class statuses, dates, URLs, and resume attachment references. Do **not** invent these fields when unspecified.

## Example: resume rules

User says: "Update my resume instructions: keep it one page, use concise XYZ bullets, and give relevant projects more space."

New memory uses category `preference`, with title `Resume guideline: formatting and evidence`. Later corrections update the **same record** through `propose_memory_update`; they do not add contradictory duplicate memories.

Example instruction to Claude after deployment:

> Search my Memory Hub for my current resume formatting guideline. Propose an update replacing it with my new rule, preserving any rules I did not ask to change. Do not claim it is approved. Show me the pending proposal ID.

## Safety and integrity

- AI clients receive only a restricted agent token. Owner approval/rejection endpoints require the owner role.
- The proposal's `source` carries provenance and is labeled `AI suggestion via MCP` or `AI correction via MCP`.
- Approved-memory reads never include pending proposals.
- Each proposed correction stores its target record's last-updated version. Approval rejects outdated corrections rather than silently overwriting changes made after the proposal.
- Proposals use the existing input validator: title, body, category, and source are mandatory and length-limited.
- Pending new proposals and pending correction proposals each have a 100-item queue cap.
- User should explicitly request remembering or updating a fact; do not propose every chat message.
- A connector may need OAuth or fixed HTTP headers, and is not considered compatible until actual end-to-end testing.

See [MCP.md](MCP.md), [SECURITY.md](SECURITY.md), [STATUS.md](STATUS.md).
