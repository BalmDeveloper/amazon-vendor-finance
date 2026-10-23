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
