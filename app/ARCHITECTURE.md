# Sales Intelligence Hub

A Next.js app (frontend and backend) with a chat interface, dashboards, action items and integrations.

```
Browser ── SSE ── Next.js route handlers ──► Snowflake SALES_INTELLIGENCE.APP (chats, messages, action items, widgets)
                        │
                        ▼
                 Vercel Sandbox (one per chat)
                 Claude Agent SDK · claude-opus-5-5 · skills
                        │ MCP over HTTP (PAT)
                        ▼
      Snowflake managed MCP server SALES_INTELLIGENCE.DATA.SALES_INTELLIGENCE_MCP
                        │ CORTEX_AGENT_RUN
                        ▼
      SALES_INTELLIGENCE_AGENT → Cortex Analyst (sales, Tesco, Amazon) + Cortex Search (call transcripts)
```

## Layout
- `sql/setup.sql`: app schema/tables, `SALES_APP_ROLE`, `SALES_APP_SVC` service user (already applied)
- `web/`: the Next.js 16 app
  - `src/app/api/chat/route.ts`: streams agent events over SSE and saves results
  - `src/lib/sandbox.ts`: Vercel Sandbox lifecycle; secrets are passed per command only
  - `sandbox/agent.mjs`: Claude Agent SDK runner (MCP config, tool allow-list)
  - `sandbox/.claude/skills/`: `sales-briefing`, `render-chart`, `create-action-item`
  - `src/lib/db.ts`: Snowflake persistence (parameterized binds only)

## Setup
1. Generate the PAT in a Snowsight worksheet as ACCOUNTADMIN:
   ```sql
   ALTER USER SALES_APP_SVC ADD PROGRAMMATIC ACCESS TOKEN SALES_APP_PAT
     ROLE_RESTRICTION = 'SALES_APP_ROLE' DAYS_TO_EXPIRY = 30;
   ```
2. Put it in `web/.env.local` as `SNOWFLAKE_PAT`, and add `ANTHROPIC_API_KEY`.
3. Get Vercel Sandbox credentials: `cd web && vercel link && vercel env pull` (writes `VERCEL_OIDC_TOKEN`).
4. `npm run dev`, then open http://localhost:3000/integrations. Every check should be green.

## Deploy
`vercel deploy`. Set the same env vars in the Vercel project. OIDC for the Sandbox is automatic there.

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

### Decision loop API (for the platform side)
All map onto `sql/04_ops_tables.sql` and `sql/05_ops_procedures.sql`.

| Method & path | Body | Returns | Backed by |
| --- | --- | --- | --- |
| `GET /api/insights` | | `Insight[]` (active) | `OPS.INSIGHTS` |
| `GET /api/recommendations` | | `Recommendation[]` (`confidence`: high/medium/low) | `OPS.RECOMMENDED_ACTIONS` |
| `POST /api/recommendations/:id` | `{action:"accept", owner, due_date?, note?}` or `{action:"dismiss", reason?}` | `{action_item_id?}` | `ACCEPT_RECOMMENDATION(id, owner)` / `DISMISS_RECOMMENDATION(id, reason)` |
| `GET /api/metrics` | | `Metrics` (see `src/lib/types.ts`) | MARTS success metrics + `SUM(outcome_amount_usd)` |
| `GET /api/actions` | | `ActionItem[]` | `OPS.ACTION_ITEMS` |
| `POST /api/actions` | `{title, detail?, owner?, due_date?, priority?, action_type?, source?}` | `ActionItem` | `CREATE_ACTION_ITEM` |
| `PATCH /api/actions/:id` | `Partial<ActionItem>` incl. `status`, `owner`, `outcome_amount_usd` | `ActionItem` | `UPDATE_ACTION_ITEM` |
| `PATCH /api/actions/bulk` | `{ids: string[], patch: Partial<ActionItem>}` | `{updated: number}` | `UPDATE_ACTION_ITEM` per id |
| `GET /api/automations` | | `Automation[]` | Snowflake tasks / alerts metadata |
| `PATCH /api/automations/:id` | `{enabled?, cadence?, threshold_usd?}` | `Automation` | `ALTER TASK … RESUME/SUSPEND`, schedule |
| `POST /api/automations/:id/run` | | `{started: true}` | `EXECUTE TASK` |

Playbook rows are sample data in `src/lib/sample.ts` today; the platform can serve them from `GET /api/playbooks/:id` with the same `Playbook` shape.
