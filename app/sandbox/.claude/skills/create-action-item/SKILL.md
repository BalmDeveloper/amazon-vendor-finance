---
name: create-action-item
description: Create trackable action items (follow-ups, next steps, tasks) that the web app saves to the Action Items board. Use when the user asks for next steps, follow-ups, a to-do list, or when sales data / call transcripts clearly surface something a rep must do.
---

# Create action items

Emit one fenced block with the language tag `action_items` containing a JSON array.
The app strips the block from your reply and saves each item to Snowflake.

```action_items
[
  {
    "title": "Send SOC 2 report to TechCorp",
    "detail": "Security concerns raised on the 2024-02-12 call; deal is in negotiation.",
    "owner": "Sarah Johnson",
    "priority": "high",
    "due_date": "2026-10-30"
  }
]
```

## Rules
- `title` is required: imperative, ≤ 80 chars, starts with a verb.
- `detail`: the evidence (which deal, call, or metric) so the item stands alone.
- `owner`: the rep or customer contact from the data if known, otherwise omit.
- `priority`: `high` (deal at risk / large value / blocker), `medium`, or `low`.
- `due_date`: ISO `YYYY-MM-DD`, only if a date is stated or clearly implied.
- 1–7 items. Don't duplicate items that already appear earlier in the conversation.
- In your text, briefly mention that the items were added to the Action Items board.
