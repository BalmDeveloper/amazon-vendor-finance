# Plan: Amazon Vendor Finance (Snowflake platform + Next.js app)

## Goal
Use the Amazon 1P vendor finance data to make the business run better: recover money Amazon deducted, explain every deduction, and collect cash faster. The deliverable is a governed Snowflake platform (data, definitions, insights, recommendations, agent, actions, alerts) plus a Next.js app on top of it with analytics, insights, recommended actions, chat and an action-item board.

## Team split
| Owner | Scope |
|---|---|
| **Platform (Berk + CoCo)** | All Snowflake work across the five layers: semantic view, summary tables, AI enrichment, search, agent, action procedures, alerts, Slack, MCP, evaluations. Phases 1–5 and 7. |
| **App (teammate)** | The Next.js Snowflake App (Phase 6). It builds only against the objects in the **App interface**, never the raw shared tables. |

## Business problems (in priority order)
Figures come from the demo data (July 2021 – April 2025) and were checked with direct SQL on 2026-10-23. Deduction figures are **cash actually deducted** (see Data facts for why claim amounts on remittance lines can't simply be summed).

1. **Shortage recovery.** Amazon deducted **$3.14M** for shortages across 1,470 claims, while shortage disputes recovered only **$43.7K**. Even if the dispute table covers only part of the period (it starts Feb 2023), this is the largest recoverable amount. The workflow: find shortages that can still be disputed → create an action item → track the outcome → measure the recovery rate.
2. **Deduction visibility.** Amazon sends 595 deduction lines ($1.82M deducted) with no description (`-____-`). **Solved with deterministic matching, not AI:** 451 of the 461 unlabeled claims match a co-op invoice on exact amount, typically 2 days after the co-op invoice date. They are co-op charges ($1.81M), so **99.8% of deducted dollars now have a category**, and only 10 claims ($9.4K) remain unresolved. Remaining work: watch co-op invoices with no matching deduction. There are 60 of them ($282K): 22 recent ones ($115K, March–April 2025) are probably still to be deducted, and 38 older ones ($167K) need review. Total deducted across all categories is **$5.39M**: Shortage $3.14M, Co-op $1.81M, Missed adjustment $99K, Damage allowance $98K, AVS/SVS $94K, operational chargebacks $70K, Returns $60K.
3. **Cash collection.** Invoiced **$10.29M**, paid **$10.00M** (a collection rate of 97.1%), about **$294K unpaid**. That includes 60 invoices worth about $150K still processing, pending Amazon action or queued for payment, plus price and quantity variances on paid invoices. A further **$346K** has been claimed by Amazon but not yet deducted, mostly damage allowances ($178K) and AVS/SVS ($125K). That's an early warning of future deductions.

**Provisions are not deductions.** `PROVISION_FOR_RECEIVABLE` lines hold back cash (−$20.53M applied) and `PROVISION_FOR_RECEIVABLE-R` lines release it (+$20.38M), leaving about $146K currently held. Provisions are tracked as a separate "reserve held" metric and never counted as deductions.

**Success metrics:** shortage recovery rate (recovered ÷ shortage deducted), share of deduction dollars categorized, unpaid amount older than 60 days, and time from a new deduction to an action item.

## Data facts (for anyone writing SQL)
- **Source:** shared Marketplace database `AMAZON_VENDOR_PL_FINANCE_REMITTANCE_AND_INVOICES_DEMO_DATASET.PUBLIC`, provided by Reason Automation. It's anonymized demo data, read-only, and all amounts are USD.
- **Names:** table and column names are **lowercase and must be double-quoted**, e.g. `PUBLIC."invoices_summaryv2"."invoice_amount"`. In semantic model YAML, quote the table names as well (`table: '"invoices_summaryv2"'`), or Cortex Analyst converts them to uppercase and can't find them.
- **Core tables:**
  - `invoices_summaryv2`: one row per invoice.
  - `payments_invoices`: remittance lines; negative amounts are deductions.
  - `payments_payments`: one row per payment; `payment_number` is unique.
  - `payments_coop`: co-op charges.
  - `payments_dispute_management_details`: shortage disputes.
- **Gaps:** `payments_invoices_expanded` is empty, so the listing's sample "Quick P&L" query returns nothing.
- **Remittance line descriptions:** `/____/` = a vendor invoice being paid (+$14.6M); `-____-` = a deduction with no label; `PROVISION_FOR_RECEIVABLE` / `-R` = a reserve held back / released.
- **Repeated claim amounts:** a deduction claim applied across several payments repeats its **full** amount on each remittance line, while `amount_paid` splits it. Never sum `invoice_amount` over remittance lines. Use `STAGING.STG_DEDUCTION_CLAIMS` (one row per claim, with `claim_amount` counted once and `deducted_amount` as the cash actually taken).
- **Shortage claims link to invoices:** a shortage claim number is `<invoice_number>-<n>SC` (1,571 of 1,583 lines match an invoice). `STG_REMITTANCE_LINES.base_invoice_number` holds the extracted invoice number.
- **Disputes barely link to claims:** only 76 of 721 disputed invoice numbers match a shortage claim's invoice, and 204 match an invoice at all. Measure recovery from the dispute table directly; treat claim-level "disputed or not" as approximate.
- **Search ("indexing") decisions:** Cortex Search needs change tracking on its sources, so it can't index the provider's shared tables directly, and it bills for serving per GB indexed. Product titles are anonymized in the demo data ("Product 7f677c30d7c4") and co-op agreements have only 8 values, so per-dimension search services aren't worth their cost yet. Add them on `PRODUCT_TITLE` and `AGREEMENT_TITLE` once real data arrives. The one service built now is `OPS.OPS_SEARCH`, over the platform's own text (dashboards, insights, recommendations), so the agent can reuse existing dashboards instead of creating duplicates.
- **Unlabeled deductions are co-op:** unlabeled lines carry no text and no reference number, only an amount, a date and a payment. They are grouped into claims by date + amount, then matched one-to-one to `payments_coop` on exact amount within −30/+5 days (`STAGING.STG_COOP_DEDUCTION_MATCH`). `STG_DEDUCTION_CLAIMS` exposes `source_category`, the resolved `category` and `category_method` (Amazon label / Matched to co-op invoice / Unresolved), so every category is auditable. AI classification was not used because there is no text to classify.

## The five layers: what we build in each
| Layer | Snowflake build |
|---|---|
| **Context** | A semantic view with verified queries, a cleaned layer of views, dynamic tables for summaries, deduction categories from deterministic matching (co-op), and tags or masking where needed. (The dataset has almost no free text, so no AI classification is needed.) |
| **Toolkit** | Cortex Analyst on the semantic view, Cortex Search over product titles, and procedures for logic with a single correct answer (whether a shortage can still be disputed, expected payment). |
| **Intelligence** | One Amazon finance Cortex Agent (`orchestration: auto`), plus an evaluation set and Agent Evaluations. |
| **Action** | An `ACTION_ITEMS` table written to through procedures, Snowflake alerts to Slack, and scheduled digests. Daily-generated **insights** and **recommended actions**, each with an estimated dollar value; accepting one creates an action item. |
| **Surface** | The Next.js app (teammate), Claude through the MCP server, and CoWork. |

**Principle:** data, business definitions, permissions and actions stay in Snowflake. The LLM reasons and chats; it never improvises calculations that have a single correct answer, and it never writes to tables directly.

## App interface (what the app builds against)
The platform team keeps these names and shapes stable. Anything not listed here may change.

| Object | Purpose | Notes |
|---|---|---|
| `AMAZON_FINANCE_APP.MARTS.*` (tables listed in Phase 2) | Dashboards and headline numbers | Query with fixed, parameterized SQL; the LLM is never in the dashboard path. |
| `AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_AGENT` | Chat | Use the Cortex Agents REST API (agent:run) and stream its events: text, tables, charts, tool results. Run as the signed-in user. |
| `AMAZON_FINANCE_APP.OPS.DASHBOARDS`, `OPS.DASHBOARD_WIDGETS` | Agent- and user-built dashboards | **Built (sql/04).** A dashboard is a definition: each widget stores `widget_type` (kpi, line, bar, area, pie, table), title, description, `query_sql`, `chart_config` and `layout`. The app runs each widget's query **as the signed-in user** and renders it, so numbers are always live and access rules apply. Show `status = 'published'` by default; drafts are visible to their creator. |
| `AMAZON_FINANCE_APP.OPS.INSIGHTS` | The insights feed | **Built (sql/04).** One row per insight: id, generated_at, business_problem, severity, title, summary, metric_name, current_value, comparison_value, change_pct, period, entity, evidence_sql, linked dashboard/widget, status. |
| `AMAZON_FINANCE_APP.OPS.RECOMMENDED_ACTIONS` | The recommended actions list | **Built (sql/04).** One row per recommendation: id, insight_id, action_type, title, rationale, entity, estimated_value_usd, confidence, status (new, accepted, dismissed, expired), expires_at. Sort by estimated value. |
| `AMAZON_FINANCE_APP.OPS.ACTION_ITEMS` | The action-item board | **Built (sql/04).** Status, owner, priority, due date, amount, outcome amount (recovered), source, links to recommendation and insight. |
| `OPS.CREATE_DASHBOARD`, `OPS.ADD_WIDGET`, `OPS.SET_DASHBOARD_STATUS` | Dashboard writes | **Built (sql/05).** `ADD_WIDGET` rejects anything but a single compiling `SELECT`/`WITH`. Agent-built dashboards start as `draft`; a person publishes them. |
| `OPS.CREATE_ACTION_ITEM`, `OPS.UPDATE_ACTION_ITEM` | Action-item writes | **Built (sql/05).** Return `{"ok": true/false, ...}`; on false, show `error`. |
| `OPS.ACCEPT_RECOMMENDATION(id, owner)`, `OPS.DISMISS_RECOMMENDATION(id, reason)` | Responding to recommendations | **Built (sql/05).** Accepting creates a linked action item. Dismissing requires a reason, which is kept for rule tuning. |
| `AMAZON_FINANCE_APP.OPS.OPS_SEARCH` | Search over dashboards, insights and recommendations | **Built (sql/04).** Cortex Search service; filter with `doc_type` (dashboard, insight, recommendation), `business_problem` or `status`. Useful for a global search box in the app. |
| Role `AMZ_FIN_APP` | The app's service role | Has only what the interface needs. |
| Warehouse `AMZ_FIN_WH` (XS) | Dashboard and app queries | Short auto-suspend. |

## Implementation steps

**Phase 1: Foundation (Context). Owner: platform.**
1. Create database `AMAZON_FINANCE_APP` with schemas `STAGING`, `SEMANTIC`, `MARTS`, `APP` and `OPS`. Create warehouse `AMZ_FIN_WH`.
2. Create roles `AMZ_FIN_ADMIN` (owns all objects), `AMZ_FIN_USER` (read access plus actions) and `AMZ_FIN_APP` (the app). Give them imported privileges on the shared database.
3. In `STAGING`, create one view per source table that gives clean column names and types, and adds `DEDUCTION_CATEGORY`, `IS_PROVISION` and `IS_SHORTAGE` flags.
4. Build the semantic view `SEMANTIC.AMAZON_VENDOR_FINANCE_SV`, starting from `semantic/amazon_vendor_finance_model.yaml` (built on `STAGING`). Then extend it to orders, retail analytics (sales, net PPM) and the product catalog, joined on ASIN or PO number once each key is confirmed unique.
5. Add verified queries:
   - shortage deducted vs recovered by month;
   - disputable shortages;
   - deductions by category;
   - share of deduction dollars not yet categorized;
   - unpaid invoice aging;
   - invoiced vs paid by month;
   - co-op by agreement;
   - top shortage ASINs;
   - net PPM by product.

**Phase 2: Summary tables and enrichment (Context and Toolkit). Owner: platform.**
6. **Deduction categories: done in Phase 1.** Co-op matching resolves 99.8% of deducted dollars (`STAGING.STG_COOP_DEDUCTION_MATCH`). This dataset has almost no free text (dispute `comments` are empty in all 1,114 rows; remittance descriptions are codes), so there's nothing to AI-classify. AI functions are used for writing insights (`AI_COMPLETE`, Phase 4b) and in the agent. If real data later brings dispute comments or Amazon correspondence, add `AI_CLASSIFY` on denial reasons then.
7. Build dynamic tables in `MARTS` with a 1-hour refresh lag:
   - `SHORTAGE_RECOVERY`: by month, deducted vs disputed vs recovered;
   - `DISPUTABLE_SHORTAGES`: line-level shortages, whether they've been disputed, and age;
   - `DEDUCTIONS_BY_CATEGORY`;
   - `UNPAID_INVOICE_AGING`;
   - `CASH_COLLECTION`: invoiced vs paid by month;
   - `COOP_BY_AGREEMENT`;
   - `MONTHLY_PNL`;
   - `SKU_PROFITABILITY`.
8. Create a Cortex Search service `OPS.AMZ_TEXT_SEARCH` over product titles (ASIN lookup by name, e.g. "the turmeric daal pot"), so chat can resolve product names to ASINs. Dispute comments are empty in this data.

**Phase 3: Agent (Intelligence and Toolkit). Owner: platform.**
9. Create `APP.AMAZON_VENDOR_FINANCE_AGENT` (spec in `agent/AMAZON_VENDOR_FINANCE_AGENT.agent.yaml`) with these tools:
   - Cortex Analyst on the semantic view;
   - Cortex Search on `AMZ_TEXT_SEARCH`;
   - `OPS.CHECK_DISPUTE_ELIGIBILITY`;
   - `OPS.CREATE_ACTION_ITEM`;
   - `OPS.LIST_ACTION_ITEMS`;
   - `OPS.NOTIFY_SLACK`.

   Instructions: be concise, put numbers in tables, name the source of each answer, never count provisions as deductions, and confirm before taking any action. Then remove the Amazon tool from `SALES_INTELLIGENCE_AGENT`.

**Phase 4: Action items written to Snowflake (Action). Owner: platform.**
10. Create `OPS.ACTION_ITEMS` with these columns: id, type (dispute_shortage, resolve_deduction, chase_payment, coop_review, price_fix), entity type and id (invoice, ASIN or PO), amount, priority, owner, status (open, in_progress, done, dismissed), due date, created_by, created_at, source (agent, user or alert), notes and outcome amount (what was recovered).
11. Write procedures that validate input, record `CURRENT_USER()`, and change nothing but `ACTION_ITEMS`. Users read `ACTION_ITEMS` directly (SELECT only); all writes go through procedures.

**Phase 4b: Insights and recommended actions (Action and Intelligence). Owner: platform.**
11a. **Detection is rules in SQL, not the LLM.** A daily task runs SQL checks over `MARTS` and writes to `OPS.INSIGHTS`. Initial checks:
   - shortage deducted this month vs the 6-month average (spike detection);
   - shortages approaching the end of the dispute window that haven't been disputed;
   - recovery rate trend;
   - new or growing unresolved deductions, and co-op invoices with no matching deduction;
   - unpaid amount by aging bucket, and its change week over week;
   - ASINs with repeated shortages (a likely receiving or carton-labelling problem);
   - co-op spend vs sales by agreement;
   - price-variance invoices clustered by product.
11b. **Wording is written by AI, numbers are not.** `AI_COMPLETE` writes each insight's title and two-sentence summary using only the numbers the rule computed. Its prompt forbids new figures, and the rule's own metric columns are stored alongside the text, so the app can show the exact numbers.
11c. **Recommendations come from the rules too.** Each insight rule maps to one or more recommended actions (e.g. "Dispute 37 shortages on 12 POs before their window closes, est. $48K"). Each one stores an estimated value calculated in SQL, a confidence level, and a link back to the insight. They're written to `OPS.RECOMMENDED_ACTIONS` with an expiry, and expired or already-handled ones are removed when the next run finds them stale.
11d. Create the procedures `ACCEPT_RECOMMENDATION` and `DISMISS_RECOMMENDATION`. Add the agent tools `LIST_INSIGHTS` and `LIST_RECOMMENDATIONS`, so chat can answer "what should I do this week?" and explain any insight using its stored evidence.
11e. **Feedback loop:** track the acceptance rate and the recovered amount for each rule (from the action item's outcome amount). Retune or retire rules that keep getting dismissed.

**Phase 5: Integrations (Action). Owner: platform.**
12. **Slack:** a webhook notification integration plus a secret, and an `OPS.NOTIFY_SLACK` procedure wrapping `SYSTEM$SEND_SNOWFLAKE_NOTIFICATION`.
13. **Alerts**, each posting to Slack and creating an action item:
    - a new shortage that can be disputed, above a threshold;
    - an invoice unpaid for more than 60 days;
    - a dispute denied;
    - a large deduction that couldn't be resolved, or a co-op invoice with no matching deduction after 30 days.
14. **Claude via MCP:**
    - create `APP.AMAZON_FINANCE_MCP` exposing the agent (`CORTEX_AGENT_RUN`, read-only hints);
    - create a public OAuth integration (PKCE) with redirect `https://claude.ai/api/mcp/auth_callback`, `ALLOWED_ROLES_LIST = (AMZ_FIN_USER)` and secondary roles off;
    - set users' default role to `AMZ_FIN_USER` and their default warehouse to `AMZ_FIN_WH`.

**Phase 6: Next.js app (Surface). Owner: teammate.**
15. Build a Snowflake App in Next.js with TypeScript, using only the **App interface** objects. Suggested pages:
    - **Overview:** headline numbers (invoiced, paid, unpaid, total deductions, shortage recovery rate, share of deductions categorized) plus trend charts, the top 3 insights, and the top recommended actions by estimated value.
    - **Insights:** a feed from `OPS.INSIGHTS`, filterable by problem area and severity. Each card shows the summary, the metric and its comparison, and a small chart, with "Ask the agent" to dig deeper in chat.
    - **Recommended Actions:** a list from `OPS.RECOMMENDED_ACTIONS`, sorted by estimated value, with Accept and Dismiss buttons that call the procedures. Show the total estimated value still open.
    - **Analytics:** pages for exploring the data with filters for date, category, ASIN and PO, all querying `MARTS`:
      - **Shortage Recovery:** disputable shortages, oldest first, with a "Create dispute action" button.
      - **Deductions:** by category, drilling down to lines, with the uncategorized lines highlighted.
      - **Cash:** unpaid invoice aging and invoiced vs paid.
      - **Co-op and SKU profitability.**
    - **Action Items:** a board with status and owner, plus the recovered amount.
    - **Chat:** a side panel that streams from the agent, renders tables and charts, shows which tools were used, and turns suggested actions into action items.
16. Dashboards query `MARTS` through server-side routes with parameterized SQL. Chat proxies the agent and runs as the signed-in user. Deploy, then grant usage to `AMZ_FIN_USER`.

**Phase 7: Quality and operations. Owner: platform.**
17. Build an evaluation set of 20–30 questions with expected answers from direct SQL, covering each business problem. Run Agent Evaluations after every change to instructions or the semantic view.
18. Review `SNOWFLAKE.LOCAL.AI_OBSERVABILITY_EVENTS` weekly and turn wrong answers into verified queries.
19. **Cost:** an XS warehouse with a short auto-suspend, and a budget or resource monitor. Lower `SALES_INTELLIGENCE_WH` auto-suspend from 3600s.

## Repo layout (`dw`)
```
docs/plan.md                          this plan
sql/01_setup.sql … sql/08_mcp.sql     numbered DDL that can be re-run
semantic/                             semantic view YAML and verified queries
agent/                                agent spec
evals/                                evaluation questions and expected answers
app/                                  Next.js app (teammate)
```

## Verification
- **Semantic view:** verified queries match hand-written SQL. Baselines: $10.29M invoiced, $10.00M paid, $3.14M shortages deducted, $5.39M total deducted, $43.7K recovered.
- **Classification:** a manual review of 50 classified lines reaches at least 90% agreement before results reach the dashboards.
- **Dynamic tables:** they refresh, and their totals match the source tables.
- **Agent:** questions on each problem, a mixed metric-plus-search question, and an action request that creates a row in `ACTION_ITEMS` with `created_by` set.
- **Insights:** every insight's numbers can be reproduced by its `evidence_sql`. Spot-check 10 AI-written summaries to confirm they contain no figures beyond the stored metrics.
- **Recommendations:** estimated values reconcile with `MARTS` totals. Accepting one creates a linked action item; dismissing one stores the reason.
- **Alerts and Slack:** a test message, then forced runs with `EXECUTE ALERT`.
- **MCP:** connect from Claude, list the tools, ask a question, and confirm the effective role is `AMZ_FIN_USER`.
- **App:** every page works, chat streams, the action-item create and update flow works, and a role without access is refused.
- **Evaluations:** pass rate at or above the agreed target (e.g. 90% answer correctness).

## Open inputs
- The `dw` repo path, once it's created.
- A Slack webhook URL, stored with `/secrets`.
- Alert thresholds (e.g. a disputable shortage above $5K, unpaid for more than 60 days).
- Which teammates get `AMZ_FIN_USER`.
- The Amazon dispute window (days from deduction) to use for "disputable" and "window closing". This needs to come from your Vendor Central terms; the data doesn't contain it.

## Known constraints
- `ATTENDEE_ROLE` can't deploy agents through `cortex agent-studio`, so agents are created with SQL as the owning role.
- Exposing Cortex Analyst directly over MCP requires a semantic view, not a YAML file.
- `~/.snowflake/connections.toml` permissions are too open for the `snow` CLI; fix with `chmod 0600`.
