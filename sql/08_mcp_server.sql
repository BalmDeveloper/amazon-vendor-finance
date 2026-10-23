-- 08_mcp_server.sql: exposes the Amazon Vendor Finance agent (and its data tools) over MCP,
-- so chat clients (the app, Claude, Cursor, ...) can call it with the user's own Snowflake identity.
-- Endpoint: https://<org>-<account>.snowflakecomputing.com/api/v2/databases/AMAZON_FINANCE_APP/schemas/APP/mcp-servers/AMAZON_VENDOR_FINANCE_MCP
-- Run as AMZ_FIN_ADMIN. Safe to re-run.

USE ROLE AMZ_FIN_ADMIN;
USE SCHEMA AMAZON_FINANCE_APP.APP;

CREATE OR REPLACE MCP SERVER AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_MCP
  FROM SPECIFICATION $$
    tools:
      - name: "amazon-vendor-finance-agent"
        type: "CORTEX_AGENT_RUN"
        identifier: "AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_AGENT"
        title: "Amazon Vendor Finance Agent"
        description: "Answers questions about Amazon 1P vendor finance (invoices, payments, deductions by category, shortages, co-op, disputes and recoveries), builds dashboards and creates action items. Ask in plain English."
        annotations:
          openWorldHint: false
      - name: "amazon-finance-analyst"
        type: "CORTEX_ANALYST_MESSAGE"
        identifier: "AMAZON_FINANCE_APP.SEMANTIC.AMAZON_VENDOR_FINANCE_SV"
        title: "Amazon Finance Analyst"
        description: "Text-to-SQL over the governed Amazon vendor finance semantic view. Returns SQL and results for a single data question."
      - name: "platform-search"
        type: "CORTEX_SEARCH_SERVICE_QUERY"
        identifier: "AMAZON_FINANCE_APP.OPS.OPS_SEARCH"
        title: "Platform Search"
        description: "Searches saved dashboards, insights and recommendations."
  $$;

GRANT USAGE ON MCP SERVER AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_MCP TO ROLE AMZ_FIN_USER;
GRANT USAGE ON MCP SERVER AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_MCP TO ROLE AMZ_FIN_APP;
