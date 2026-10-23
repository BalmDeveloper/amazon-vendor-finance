---
name: sales-briefing
description: How to query the governed Snowflake Sales Intelligence agent and present results. Use for any question about sales deals, pipeline, reps, win rates, sales call transcripts, Tesco retail sales, or Amazon vendor finance.
---

# Sales briefing

## Calling Snowflake
The only data source is the MCP tool `mcp__snowflake__sales_intelligence_agent`
(a Snowflake Cortex Agent). It routes internally to:
- **SalesMetricsAnalyst**: deal value, close date, stage, win status, rep, product line, customer
- **SalesConversationSearch**: call transcripts (concerns, objections, requirements, next steps)
- **TescoSalesAnalyst**: Tesco weekly sales by product, store, supplier, promotion
- **AmazonVendorFinanceAnalyst**: Amazon 1P invoices, remittance, co-op deductions, disputes

Tips:
- Send one focused, self-contained question per call (include time ranges and filters).
- For multi-part asks (e.g. "top deals AND what customers worried about"), make separate calls.
- When you need a chart, ask for the result **as a table with explicit column names**.
- If the tool errors or returns nothing, say so plainly; never fill gaps with guesses.

## Answer format
1. **Headline**: one sentence with the key number or finding.
2. **Details**: short bullets or a chart (render-chart skill).
3. **Source**: one line naming which Snowflake tool(s) answered (Analyst vs. Search).
4. **Next steps** (optional): if action is warranted, use the create-action-item skill.
