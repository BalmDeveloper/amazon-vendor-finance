# Amazon Vendor Finance app

Next.js 16 app deployed on Snowflake App Runtime (`app.yml`). Every query runs as the signed-in user.

```
Browser ── SSE ── Next.js route handlers ──► AMAZON_FINANCE_APP.OPS / APP (procedures, owner's rights)
                        │
                        ▼
        Cortex Agent AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_AGENT (src/lib/agent.ts)
        FinanceAnalyst (semantic view) · PlatformSearch · SaveDashboard · CreateActionItem
```

## UI: question → decision → outcome
The UI is built around the goal "get people from question to decision faster, and automate recurring multi-step work with fewer handoffs".

| Route | Purpose |
| --- | --- |
| `/` Today | Money at stake, success metrics from `docs/plan.md`, top 3 decisions (Accept / Dismiss / Ask why), my work, playbooks |
| `/assistant` | Chat. Every chart has a decision bar (create action item, pin, ask follow-up, share); follow-up suggestions after each answer |
| `/insights` | Insight feed + recommended actions, with bulk accept/dismiss and "Run playbook" |
| `/actions` | Board with Mine/Overdue filters, bulk assign/start/done; marking done records `outcome_amount_usd` |
| `/playbooks/[id]` | Guided pick → assign → create flows for shortage disputes, unexplained deductions, cash collection |
| `/automations` | Weekly digest, large-deduction alert, daily insight refresh: on/off, cadence, threshold, run now |
| ⌘K | Command palette: pages, ask the assistant, find insights, recommendations, action items |

Shared state lives in `src/lib/ops-store.tsx`: optimistic writes with rollback. When the endpoints below are missing, the UI runs in **sample mode** (badge shown, nothing persisted).

### API used by the UI
| Method & path | Body | Backed by |
| --- | --- | --- |
| `GET /api/insights` | | `{insights, recommendations}` from `OPS.INSIGHTS`, `OPS.RECOMMENDED_ACTIONS` |
| `POST /api/recommendations/:id` | `{decision:"accept"}` or `{decision:"dismiss", reason?}` | `ACCEPT_RECOMMENDATION` / `DISMISS_RECOMMENDATION` |
| `GET/POST /api/actions`, `PATCH /api/actions/:id` | `{status?, owner?, notes?, outcome_amount_usd?}` | `CREATE_ACTION_ITEM` / `UPDATE_ACTION_ITEM` |
| `GET /api/dashboards`, `GET/PATCH /api/dashboards/:id`, `POST /api/dashboards/widgets` | | `CREATE_DASHBOARD`, `ADD_WIDGET`, `SET_DASHBOARD_STATUS` |

After accepting, the UI PATCHes the new action item with the chosen owner and note.

### Not built yet (UI falls back to sample data)
- `GET /api/metrics`: success metrics other than recovered-to-date, which is computed from `outcome_amount_usd`
- Pass `owner` through to `ACCEPT_RECOMMENDATION(id, OWNER)`, and accept `due_date` on PATCH
- `GET/PATCH /api/automations`, `POST /api/automations/:id/run`: Snowflake tasks/alerts behind the Automations page
- `GET /api/playbooks/:id`: real candidate rows (playbooks use sample rows today)
