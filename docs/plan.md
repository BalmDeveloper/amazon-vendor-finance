---
created: 2026-10-23T19:11:39.981Z
session: 908e8fca-b5af-4b71-9290-58bccf0f4460
working_directory: /Users/berkgungor/sfguide-getting-started-with-cortex-agents
---

# Plan: Amazon Vendor Finance App (Next.js on Snowflake, chat + dashboards + action items)

## Context
- Data: shared database `AMAZON_VENDOR_PL_FINANCE_REMITTANCE_AND_INVOICES_DEMO_DATASET.PUBLIC` (26 tables, lowercase names that must be quoted, USD, read-only). `payments_invoices_expanded` is empty.
- Already built: `semantic/amazon_vendor_finance_model.yaml` (5 finance tables, validated with Cortex Analyst), `SALES_INTELLIGENCE_AGENT` (mixes deals, Tesco and Amazon), MCP server `SALES_INTELLIGENCE.DATA.SALES_INTELLIGENCE_MCP`, warehouse `SALES_INTELLIGENCE_WH`, role `SALES_INTELLIGENCE_ROLE`.
- Your choices: a Next.js Snowflake App, Claude via MCP and Slack first, internal users only.
- Known constraints: `ATTENDEE_ROLE` can't deploy agents through `cortex agent-studio`, so I'll keep using SQL as the owning role. Exposing Cortex Analyst directly over MCP requires semantic views. The connections.toml permissions are too open for the `snow` CLI (fix with `chmod 0600`).
- The framework is the five dimensions from the slide (Surface, Context, Toolkit, Intelligence, Action).

## Implementation steps

**Step 0: Save the plan.** Write this plan to `~/Desktop/amazon_vendor_finance_app_plan.md`.

**Phase 1: Foundation (Context).**
1. Create `AMAZON_FINANCE_APP` with schemas `SEMANTIC`, `MARTS`, `APP` and `OPS`.
2. Create roles `AMZ_FIN_ADMIN` (owns everything), `AMZ_FIN_USER` (read plus actions) and `AMZ_FIN_APP` (the app's service role). Give `AMZ_FIN_USER` imported privileges on the shared database.
3. Convert the YAML model into the semantic view `SEMANTIC.AMAZON_VENDOR_FINANCE_SV`. Extend it to `orders_confirmed_pos`, `orders_shipments`, `retail_analytics_sales`, `retail_analytics_net_ppm` and `product_catalog_snapshot`, joined on ASIN and PO number where the keys are unique (I'll check each one).
4. Add 8–10 verified queries: monthly P&L, cash collected vs invoiced, unpaid invoices older than 60 days, deductions by type, co-op by agreement, dispute recovery rate, top shortage ASINs, PPM by product.

**Phase 2: Computed tables for dashboards (Context and Toolkit).**
5. Build dynamic tables in `MARTS` with a 1-hour refresh lag: `MONTHLY_PNL`, `CASH_COLLECTION`, `DEDUCTIONS_BY_TYPE`, `COOP_BY_AGREEMENT`, `DISPUTE_RECOVERY`, `UNPAID_INVOICE_AGING`, `SKU_PROFITABILITY`.
6. Create a Cortex Search service `AMZ_TEXT_SEARCH` over dispute comments and product titles, and remittance descriptions if they turn out to be useful.

**Phase 3: Agent (Intelligence and Toolkit).**
7. Create `AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_AGENT` with `orchestration: auto` and these tools:
   - Cortex Analyst on the semantic view;
   - Cortex Search on `AMZ_TEXT_SEARCH`;
   - custom procedures `CREATE_ACTION_ITEM`, `UPDATE_ACTION_ITEM` and `LIST_ACTION_ITEMS`;
   - `NOTIFY_SLACK`.

   Its instructions cover being concise, giving numbers in tables, naming the source of each answer, and confirming before taking an action. It replaces the Amazon tool on `SALES_INTELLIGENCE_AGENT`, which I'll remove from that agent.

**Phase 4: Governed write-back (Action).**
8. Create `OPS.ACTION_ITEMS` with these columns: id, type (dispute, chase payment, co-op review, price fix), entity reference (invoice, ASIN or PO), amount, priority, owner, status, due date, created_by, created_at, source (agent, user or alert) and notes.
9. Write the procedures so they validate input, record `CURRENT_USER()`, and touch nothing but `ACTION_ITEMS`. Users read through a view filtered by role.

**Phase 5: Integrations (Action).**
10. **Slack:** a webhook notification integration plus a secret, with a `NOTIFY_SLACK` procedure wrapping `SYSTEM$SEND_SNOWFLAKE_NOTIFICATION`. You provide the webhook URL as a secret; I won't put it in chat.
11. **Alerts:** Snowflake alerts for a shortage deducted in the last 7 days above a threshold, invoices unpaid for more than 60 days, and a new denied dispute. Each one posts to Slack and inserts an action item.
12. **Claude via MCP:** a new `APP.AMAZON_FINANCE_MCP` exposing the agent (`CORTEX_AGENT_RUN`, read-only hints). Create a public OAuth integration (PKCE) with redirect `https://claude.ai/api/mcp/auth_callback`, `ALLOWED_ROLES_LIST = (AMZ_FIN_USER)` and secondary roles off. Set users' default role to `AMZ_FIN_USER` and set a default warehouse.

**Phase 6: Next.js app (Surface).**
13. Load the `snowflake-apps` skill and create the app from its template in `~/Desktop/amazon-vendor-finance/app`, using TypeScript, Tailwind and a charting library from the template.
14. Pages:
    - **Overview:** headline numbers (invoiced, paid, unpaid, deductions, recovery %) plus monthly P&L and cash trend charts.
    - **Deductions & Co-op:** breakdowns and drill-down tables.
    - **Disputes:** recovery funnel and top shortage ASINs.
    - **Action Items:** a board filtered by status and owner, with inline updates done through the procedures.
    - **Chat:** a side panel that streams replies from the agent API and renders text, tables and charts. Each reply shows which tools were used, and replies get "Create action item" buttons.
15. Server-side API routes query the `MARTS` tables with fixed, parameterized SQL, so the dashboards never go through the LLM. A chat route proxies the agent and streams its events (text, table, chart and tool-result events). It runs as the signed-in user so access control applies.
16. Deploy as a Snowflake App and grant usage to `AMZ_FIN_USER`.

**Phase 7: Quality and operations.**
17. Build an evaluation set of 20–30 questions with expected answers taken from direct SQL, and run Agent Evaluations. Re-run it on every change to instructions or the semantic view.
18. Lower `SALES_INTELLIGENCE_WH` auto-suspend to 60–300 seconds, or create a dedicated XS warehouse for the app. Add a budget or resource monitor.
19. Keep all DDL, the YAML and the app code in a git repo with numbered SQL scripts so the environment can be rebuilt.

## Verification
- **Semantic view:** compare each verified query's results with hand-written SQL, using the earlier figures as checks ($10.29M invoiced, $10.00M paid, $43.7K recovered).
- **Dynamic tables:** confirm they refresh and their totals match the source tables.
- **Agent:** run questions covering metrics, search, both together, and an action ("create a dispute action for invoice X"). Check that a row lands in `ACTION_ITEMS` with `created_by` set.
- **Slack and alerts:** a test message, then a forced alert run with `EXECUTE ALERT`.
- **MCP:** connect from Claude, list the tools, ask a question, and confirm the effective role is `AMZ_FIN_USER`.
- **App:** run the local dev server, then deploy. Test each page, the chat streaming and charts, the action-item create and update flow, and that a role without access is refused.
- **Evaluations:** pass rate at or above a target we agree on (e.g. 90% answer correctness).

## Critical files
- `~/Desktop/amazon_vendor_finance_app_plan.md` - this plan
- `semantic/amazon_vendor_finance_model.yaml` - the starting point for the semantic view
- `agent/AMAZON_VENDOR_FINANCE_AGENT.agent.yaml` - the new agent spec
- `~/Desktop/amazon-vendor-finance/app/` (Next.js: `app/api/chat/route.ts`, `app/api/metrics/*`, `app/(pages)`) - the app
- `sql/01_setup.sql` … `sql/07_alerts.sql` - DDL that can be re-run

## Inputs I'll need from you
- A Slack webhook URL, stored with `/secrets`.
- Alert thresholds, e.g. shortage above $5K per week and unpaid for more than 60 days.
- Which teammates get `AMZ_FIN_USER`.
