-- 04_ops_tables.sql: tables for agent- and rule-generated state.
-- Dashboards, widgets, insights, recommendations and action items.
-- Users and the app read these tables; all writes go through OPS procedures (05_ops_procedures.sql).
-- Change tracking is on so the Cortex Search service can index them incrementally.
-- Run as AMZ_FIN_ADMIN. Safe to re-run (CREATE ... IF NOT EXISTS keeps data).

USE ROLE AMZ_FIN_ADMIN;
USE WAREHOUSE AMZ_FIN_WH;
USE SCHEMA AMAZON_FINANCE_APP.OPS;

CREATE SEQUENCE IF NOT EXISTS OPS_ID_SEQ;

-- A dashboard is a definition, never data: widgets store queries the app runs fresh.
CREATE TABLE IF NOT EXISTS DASHBOARDS (
    dashboard_id        VARCHAR       NOT NULL PRIMARY KEY,
    title               VARCHAR       NOT NULL,
    description         VARCHAR,
    business_problem    VARCHAR       COMMENT 'shortage_recovery | deduction_visibility | cash_collection | coop | other',
    tags                ARRAY,
    source_question     VARCHAR       COMMENT 'The user question that led the agent to build it, if any',
    status              VARCHAR       NOT NULL DEFAULT 'draft' COMMENT 'draft | published | archived',
    version             NUMBER        NOT NULL DEFAULT 1,
    owner               VARCHAR,
    created_by          VARCHAR       NOT NULL COMMENT 'Snowflake user who created it',
    created_via         VARCHAR       NOT NULL DEFAULT 'user' COMMENT 'agent | user | system',
    created_at          TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    published_by        VARCHAR,
    published_at        TIMESTAMP_LTZ
) CHANGE_TRACKING = TRUE COMMENT = 'Dashboard definitions (agent- or user-built)';

CREATE TABLE IF NOT EXISTS DASHBOARD_WIDGETS (
    widget_id           VARCHAR       NOT NULL PRIMARY KEY,
    dashboard_id        VARCHAR       NOT NULL,
    position            NUMBER        NOT NULL COMMENT 'Display order',
    layout              OBJECT        COMMENT '{"row":0,"col":0,"w":6,"h":4}',
    widget_type         VARCHAR       NOT NULL COMMENT 'kpi | line | bar | area | pie | table',
    title               VARCHAR       NOT NULL,
    description         VARCHAR,
    query_sql           VARCHAR       NOT NULL COMMENT 'Read-only SELECT; validated on insert',
    semantic_view       VARCHAR       COMMENT 'Semantic view the query uses, if any',
    metrics             ARRAY,
    dimensions          ARRAY,
    filters             OBJECT,
    chart_config        OBJECT        COMMENT '{"x":"MONTH","y":["DEDUCTED"],"format":"usd"}',
    created_by          VARCHAR       NOT NULL,
    created_at          TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
) CHANGE_TRACKING = TRUE COMMENT = 'Widgets of a dashboard; each stores a query, not data';

CREATE TABLE IF NOT EXISTS INSIGHTS (
    insight_id          VARCHAR       NOT NULL PRIMARY KEY,
    rule_id             VARCHAR       COMMENT 'Detection rule that produced it; NULL if agent-written',
    generated_at        TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    business_problem    VARCHAR,
    severity            VARCHAR       NOT NULL COMMENT 'high | medium | low',
    title               VARCHAR       NOT NULL,
    summary             VARCHAR       NOT NULL COMMENT 'Wording may be AI-written; numbers come from the metric columns',
    metric_name         VARCHAR,
    current_value       NUMBER(18,2),
    comparison_value    NUMBER(18,2),
    change_pct          NUMBER(9,4),
    period_start        DATE,
    period_end          DATE,
    entity_type         VARCHAR       COMMENT 'invoice | asin | po | agreement | category | business',
    entity_id           VARCHAR,
    evidence_sql        VARCHAR       COMMENT 'Query that reproduces the numbers',
    dashboard_id        VARCHAR,
    widget_id           VARCHAR,
    status              VARCHAR       NOT NULL DEFAULT 'active' COMMENT 'active | resolved | expired',
    created_via         VARCHAR       NOT NULL DEFAULT 'rule' COMMENT 'rule | agent'
) CHANGE_TRACKING = TRUE COMMENT = 'Detected insights';

CREATE TABLE IF NOT EXISTS RECOMMENDED_ACTIONS (
    recommendation_id   VARCHAR       NOT NULL PRIMARY KEY,
    insight_id          VARCHAR,
    rule_id             VARCHAR,
    action_type         VARCHAR       NOT NULL COMMENT 'dispute_shortage | resolve_deduction | chase_payment | coop_review | price_fix',
    title               VARCHAR       NOT NULL,
    rationale           VARCHAR,
    entity_type         VARCHAR,
    entity_id           VARCHAR,
    estimated_value_usd NUMBER(18,2)  COMMENT 'Computed in SQL, never by the LLM',
    confidence          VARCHAR       COMMENT 'high | medium | low',
    status              VARCHAR       NOT NULL DEFAULT 'new' COMMENT 'new | accepted | dismissed | expired',
    dismiss_reason      VARCHAR,
    action_item_id      VARCHAR       COMMENT 'Set when accepted',
    created_at          TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    expires_at          TIMESTAMP_LTZ,
    decided_by          VARCHAR,
    decided_at          TIMESTAMP_LTZ
) CHANGE_TRACKING = TRUE COMMENT = 'Recommended actions with estimated value';

CREATE TABLE IF NOT EXISTS ACTION_ITEMS (
    action_item_id      VARCHAR       NOT NULL PRIMARY KEY,
    action_type         VARCHAR       NOT NULL COMMENT 'dispute_shortage | resolve_deduction | chase_payment | coop_review | price_fix | other',
    title               VARCHAR       NOT NULL,
    notes               VARCHAR,
    entity_type         VARCHAR,
    entity_id           VARCHAR,
    amount_usd          NUMBER(18,2),
    priority            VARCHAR       NOT NULL DEFAULT 'medium' COMMENT 'high | medium | low',
    owner               VARCHAR,
    status              VARCHAR       NOT NULL DEFAULT 'open' COMMENT 'open | in_progress | done | dismissed',
    due_date            DATE,
    outcome_amount_usd  NUMBER(18,2)  COMMENT 'Amount actually recovered or collected',
    source              VARCHAR       NOT NULL COMMENT 'agent | user | alert | recommendation',
    recommendation_id   VARCHAR,
    insight_id          VARCHAR,
    created_by          VARCHAR       NOT NULL,
    created_at          TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_by          VARCHAR,
    updated_at          TIMESTAMP_LTZ NOT NULL DEFAULT CURRENT_TIMESTAMP()
) CHANGE_TRACKING = TRUE COMMENT = 'Action items; writes only via OPS procedures';

-- Searchable text for Cortex Search: what the platform itself writes.
CREATE OR REPLACE VIEW SEARCH_DOCUMENTS COMMENT = 'Dashboards, insights and recommendations as searchable documents' AS
SELECT
    'dashboard:' || dashboard_id                  AS doc_id,
    'dashboard'                                   AS doc_type,
    dashboard_id                                  AS object_id,
    title,
    title || '. ' || COALESCE(description, '') || ' ' || COALESCE(source_question, '') AS search_text,
    business_problem,
    status,
    updated_at                                    AS doc_date
FROM DASHBOARDS
UNION ALL
SELECT 'insight:' || insight_id, 'insight', insight_id, title,
       title || '. ' || summary, business_problem, status, generated_at
FROM INSIGHTS
UNION ALL
SELECT 'recommendation:' || recommendation_id, 'recommendation', recommendation_id, title,
       title || '. ' || COALESCE(rationale, ''), action_type, status, created_at
FROM RECOMMENDED_ACTIONS;

-- Read access. No INSERT/UPDATE/DELETE grants: writes go through procedures.
GRANT SELECT ON TABLE DASHBOARDS          TO ROLE AMZ_FIN_USER;
GRANT SELECT ON TABLE DASHBOARD_WIDGETS   TO ROLE AMZ_FIN_USER;
GRANT SELECT ON TABLE INSIGHTS            TO ROLE AMZ_FIN_USER;
GRANT SELECT ON TABLE RECOMMENDED_ACTIONS TO ROLE AMZ_FIN_USER;
GRANT SELECT ON TABLE ACTION_ITEMS        TO ROLE AMZ_FIN_USER;
GRANT SELECT ON TABLE DASHBOARDS          TO ROLE AMZ_FIN_APP;
GRANT SELECT ON TABLE DASHBOARD_WIDGETS   TO ROLE AMZ_FIN_APP;
GRANT SELECT ON TABLE INSIGHTS            TO ROLE AMZ_FIN_APP;
GRANT SELECT ON TABLE RECOMMENDED_ACTIONS TO ROLE AMZ_FIN_APP;
GRANT SELECT ON TABLE ACTION_ITEMS        TO ROLE AMZ_FIN_APP;

-- One search service over the platform's own text. Small index, so serving cost stays low;
-- serving suspends after 30 minutes idle (the minimum).
CREATE CORTEX SEARCH SERVICE IF NOT EXISTS OPS_SEARCH
  ON search_text
  PRIMARY KEY (doc_id)
  ATTRIBUTES doc_type, business_problem, status
  WAREHOUSE = AMZ_FIN_WH
  TARGET_LAG = '15 minutes'
  AUTO_SUSPEND = 1800
  COMMENT = 'Search dashboards, insights and recommendations'
  AS (SELECT doc_id, doc_type, object_id, title, search_text, business_problem, status, doc_date FROM SEARCH_DOCUMENTS);

GRANT USAGE ON CORTEX SEARCH SERVICE OPS_SEARCH TO ROLE AMZ_FIN_USER;
GRANT USAGE ON CORTEX SEARCH SERVICE OPS_SEARCH TO ROLE AMZ_FIN_APP;
