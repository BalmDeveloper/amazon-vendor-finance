-- 05_ops_procedures.sql: the only write path into OPS tables.
-- Owner's-rights procedures: callers need USAGE on the procedure, not write grants on tables.
-- Every procedure validates inputs and records the calling user.
-- Run as AMZ_FIN_ADMIN. Safe to re-run.

USE ROLE AMZ_FIN_ADMIN;
USE WAREHOUSE AMZ_FIN_WH;
USE SCHEMA AMAZON_FINANCE_APP.OPS;

-- Returns NULL if the query is an acceptable read-only SELECT that compiles, else an error message.
CREATE OR REPLACE PROCEDURE VALIDATE_READ_QUERY(QUERY_SQL VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    q VARCHAR;
BEGIN
    q := TRIM(REGEXP_REPLACE(:QUERY_SQL, ';\\s*$', ''));
    IF (q IS NULL OR q = '') THEN
        RETURN 'Query is empty';
    END IF;
    IF (NOT REGEXP_LIKE(q, '^\\s*(SELECT|WITH)\\b.*', 'is')) THEN
        RETURN 'Query must start with SELECT or WITH';
    END IF;
    IF (CONTAINS(q, ';')) THEN
        RETURN 'Only a single statement is allowed';
    END IF;
    IF (REGEXP_LIKE(q, '.*\\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|COPY|PUT|REMOVE|EXECUTE)\\b.*', 'is')) THEN
        RETURN 'Query contains a statement that is not allowed';
    END IF;
    BEGIN
        EXECUTE IMMEDIATE 'EXPLAIN USING TEXT ' || q;
    EXCEPTION
        WHEN OTHER THEN
            RETURN 'Query does not compile: ' || SQLERRM;
    END;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE CREATE_DASHBOARD(
    TITLE VARCHAR, DESCRIPTION VARCHAR, BUSINESS_PROBLEM VARCHAR,
    SOURCE_QUESTION VARCHAR, CREATED_VIA VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    new_id VARCHAR;
    via VARCHAR DEFAULT LOWER(COALESCE(:CREATED_VIA, 'user'));
BEGIN
    IF (:TITLE IS NULL OR TRIM(:TITLE) = '') THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Title is required');
    END IF;
    IF (via NOT IN ('agent', 'user', 'system')) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'created_via must be agent, user or system');
    END IF;
    new_id := 'DSH-' || OPS_ID_SEQ.NEXTVAL;
    INSERT INTO DASHBOARDS (dashboard_id, title, description, business_problem, source_question, created_by, created_via)
    VALUES (:new_id, TRIM(:TITLE), :DESCRIPTION, :BUSINESS_PROBLEM, :SOURCE_QUESTION, CURRENT_USER(), :via);
    RETURN OBJECT_CONSTRUCT('ok', TRUE, 'dashboard_id', new_id, 'status', 'draft');
END;
$$;

CREATE OR REPLACE PROCEDURE ADD_WIDGET(
    DASHBOARD_ID VARCHAR, WIDGET_TYPE VARCHAR, TITLE VARCHAR, DESCRIPTION VARCHAR,
    QUERY_SQL VARCHAR, CHART_CONFIG VARIANT)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    new_id VARCHAR;
    wtype VARCHAR DEFAULT LOWER(:WIDGET_TYPE);
    validation VARCHAR;
    next_pos NUMBER;
    dash_status VARCHAR;
BEGIN
    SELECT MAX(status) INTO :dash_status FROM DASHBOARDS WHERE dashboard_id = :DASHBOARD_ID;
    IF (dash_status IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Dashboard not found');
    END IF;
    IF (dash_status = 'archived') THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Dashboard is archived');
    END IF;
    IF (wtype NOT IN ('kpi', 'line', 'bar', 'area', 'pie', 'table')) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'widget_type must be kpi, line, bar, area, pie or table');
    END IF;
    CALL VALIDATE_READ_QUERY(:QUERY_SQL) INTO :validation;
    IF (validation IS NOT NULL) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', validation);
    END IF;
    SELECT COALESCE(MAX(position), 0) + 1 INTO :next_pos FROM DASHBOARD_WIDGETS WHERE dashboard_id = :DASHBOARD_ID;
    new_id := 'WGT-' || OPS_ID_SEQ.NEXTVAL;
    INSERT INTO DASHBOARD_WIDGETS (widget_id, dashboard_id, position, widget_type, title, description,
                                   query_sql, semantic_view, chart_config, created_by)
    SELECT :new_id, :DASHBOARD_ID, :next_pos, :wtype, :TITLE, :DESCRIPTION, :QUERY_SQL,
           IFF(CONTAINS(UPPER(:QUERY_SQL), 'SEMANTIC_VIEW('), 'AMAZON_FINANCE_APP.SEMANTIC.AMAZON_VENDOR_FINANCE_SV', NULL),
           :CHART_CONFIG::OBJECT, CURRENT_USER();
    UPDATE DASHBOARDS SET updated_at = CURRENT_TIMESTAMP(), version = version + 1 WHERE dashboard_id = :DASHBOARD_ID;
    RETURN OBJECT_CONSTRUCT('ok', TRUE, 'widget_id', new_id, 'position', next_pos);
END;
$$;

CREATE OR REPLACE PROCEDURE SET_DASHBOARD_STATUS(DASHBOARD_ID VARCHAR, NEW_STATUS VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    st VARCHAR DEFAULT LOWER(:NEW_STATUS);
    widgets NUMBER;
BEGIN
    IF (st NOT IN ('draft', 'published', 'archived')) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'status must be draft, published or archived');
    END IF;
    SELECT COUNT(*) INTO :widgets FROM DASHBOARD_WIDGETS WHERE dashboard_id = :DASHBOARD_ID;
    IF (st = 'published' AND widgets = 0) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Cannot publish a dashboard with no widgets');
    END IF;
    UPDATE DASHBOARDS
       SET status = :st, updated_at = CURRENT_TIMESTAMP(),
           published_by = IFF(:st = 'published', CURRENT_USER(), published_by),
           published_at = IFF(:st = 'published', CURRENT_TIMESTAMP(), published_at)
     WHERE dashboard_id = :DASHBOARD_ID;
    IF (SQLROWCOUNT = 0) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Dashboard not found');
    END IF;
    RETURN OBJECT_CONSTRUCT('ok', TRUE, 'dashboard_id', :DASHBOARD_ID, 'status', st);
END;
$$;

CREATE OR REPLACE PROCEDURE CREATE_ACTION_ITEM(
    ACTION_TYPE VARCHAR, TITLE VARCHAR, ENTITY_TYPE VARCHAR, ENTITY_ID VARCHAR,
    AMOUNT_USD NUMBER(18,2), PRIORITY VARCHAR, OWNER VARCHAR, DUE_DATE DATE,
    NOTES VARCHAR, SOURCE VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    new_id VARCHAR;
    atype VARCHAR DEFAULT LOWER(:ACTION_TYPE);
    prio VARCHAR DEFAULT LOWER(COALESCE(:PRIORITY, 'medium'));
    src VARCHAR DEFAULT LOWER(COALESCE(:SOURCE, 'user'));
BEGIN
    IF (atype NOT IN ('dispute_shortage', 'resolve_deduction', 'chase_payment', 'coop_review', 'price_fix', 'other')) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Unknown action_type');
    END IF;
    IF (prio NOT IN ('high', 'medium', 'low')) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'priority must be high, medium or low');
    END IF;
    IF (src NOT IN ('agent', 'user', 'alert', 'recommendation')) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'source must be agent, user, alert or recommendation');
    END IF;
    IF (:TITLE IS NULL OR TRIM(:TITLE) = '') THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Title is required');
    END IF;
    new_id := 'ACT-' || OPS_ID_SEQ.NEXTVAL;
    INSERT INTO ACTION_ITEMS (action_item_id, action_type, title, notes, entity_type, entity_id, amount_usd,
                              priority, owner, due_date, source, created_by, updated_by)
    VALUES (:new_id, :atype, TRIM(:TITLE), :NOTES, :ENTITY_TYPE, :ENTITY_ID, :AMOUNT_USD,
            :prio, COALESCE(:OWNER, CURRENT_USER()), :DUE_DATE, :src, CURRENT_USER(), CURRENT_USER());
    RETURN OBJECT_CONSTRUCT('ok', TRUE, 'action_item_id', new_id);
END;
$$;

CREATE OR REPLACE PROCEDURE UPDATE_ACTION_ITEM(
    ACTION_ITEM_ID VARCHAR, NEW_STATUS VARCHAR, OWNER VARCHAR,
    OUTCOME_AMOUNT_USD NUMBER(18,2), NOTES VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    st VARCHAR DEFAULT LOWER(:NEW_STATUS);
BEGIN
    IF (st IS NOT NULL AND st NOT IN ('open', 'in_progress', 'done', 'dismissed')) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'status must be open, in_progress, done or dismissed');
    END IF;
    UPDATE ACTION_ITEMS
       SET status             = COALESCE(:st, status),
           owner              = COALESCE(:OWNER, owner),
           outcome_amount_usd = COALESCE(:OUTCOME_AMOUNT_USD, outcome_amount_usd),
           notes              = IFF(:NOTES IS NULL, notes,
                                    COALESCE(notes || '\n', '') || TO_CHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD HH24:MI') || ' ' || CURRENT_USER() || ': ' || :NOTES),
           updated_by         = CURRENT_USER(),
           updated_at         = CURRENT_TIMESTAMP()
     WHERE action_item_id = :ACTION_ITEM_ID;
    IF (SQLROWCOUNT = 0) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Action item not found');
    END IF;
    RETURN OBJECT_CONSTRUCT('ok', TRUE, 'action_item_id', :ACTION_ITEM_ID);
END;
$$;

CREATE OR REPLACE PROCEDURE ACCEPT_RECOMMENDATION(RECOMMENDATION_ID VARCHAR, OWNER VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
    new_id VARCHAR;
    cur_status VARCHAR;
BEGIN
    SELECT MAX(status) INTO :cur_status FROM RECOMMENDED_ACTIONS WHERE recommendation_id = :RECOMMENDATION_ID;
    IF (cur_status IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Recommendation not found');
    END IF;
    IF (cur_status <> 'new') THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Recommendation is already ' || cur_status);
    END IF;
    new_id := 'ACT-' || OPS_ID_SEQ.NEXTVAL;
    INSERT INTO ACTION_ITEMS (action_item_id, action_type, title, notes, entity_type, entity_id, amount_usd,
                              priority, owner, source, recommendation_id, insight_id, created_by, updated_by)
    SELECT :new_id, action_type, title, rationale, entity_type, entity_id, estimated_value_usd,
           CASE confidence WHEN 'high' THEN 'high' WHEN 'low' THEN 'low' ELSE 'medium' END,
           COALESCE(:OWNER, CURRENT_USER()), 'recommendation', recommendation_id, insight_id,
           CURRENT_USER(), CURRENT_USER()
      FROM RECOMMENDED_ACTIONS WHERE recommendation_id = :RECOMMENDATION_ID;
    UPDATE RECOMMENDED_ACTIONS
       SET status = 'accepted', action_item_id = :new_id, decided_by = CURRENT_USER(), decided_at = CURRENT_TIMESTAMP()
     WHERE recommendation_id = :RECOMMENDATION_ID;
    RETURN OBJECT_CONSTRUCT('ok', TRUE, 'recommendation_id', :RECOMMENDATION_ID, 'action_item_id', new_id);
END;
$$;

CREATE OR REPLACE PROCEDURE DISMISS_RECOMMENDATION(RECOMMENDATION_ID VARCHAR, REASON VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
BEGIN
    IF (:REASON IS NULL OR TRIM(:REASON) = '') THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'A reason is required');
    END IF;
    UPDATE RECOMMENDED_ACTIONS
       SET status = 'dismissed', dismiss_reason = :REASON, decided_by = CURRENT_USER(), decided_at = CURRENT_TIMESTAMP()
     WHERE recommendation_id = :RECOMMENDATION_ID AND status = 'new';
    IF (SQLROWCOUNT = 0) THEN
        RETURN OBJECT_CONSTRUCT('ok', FALSE, 'error', 'Recommendation not found or already decided');
    END IF;
    RETURN OBJECT_CONSTRUCT('ok', TRUE, 'recommendation_id', :RECOMMENDATION_ID, 'status', 'dismissed');
END;
$$;

-- Users and the app can call the write procedures; VALIDATE_READ_QUERY is internal.
GRANT USAGE ON PROCEDURE CREATE_DASHBOARD(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO ROLE AMZ_FIN_USER;
GRANT USAGE ON PROCEDURE ADD_WIDGET(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARIANT) TO ROLE AMZ_FIN_USER;
GRANT USAGE ON PROCEDURE SET_DASHBOARD_STATUS(VARCHAR, VARCHAR) TO ROLE AMZ_FIN_USER;
GRANT USAGE ON PROCEDURE CREATE_ACTION_ITEM(VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMBER, VARCHAR, VARCHAR, DATE, VARCHAR, VARCHAR) TO ROLE AMZ_FIN_USER;
GRANT USAGE ON PROCEDURE UPDATE_ACTION_ITEM(VARCHAR, VARCHAR, VARCHAR, NUMBER, VARCHAR) TO ROLE AMZ_FIN_USER;
GRANT USAGE ON PROCEDURE ACCEPT_RECOMMENDATION(VARCHAR, VARCHAR) TO ROLE AMZ_FIN_USER;
GRANT USAGE ON PROCEDURE DISMISS_RECOMMENDATION(VARCHAR, VARCHAR) TO ROLE AMZ_FIN_USER;
GRANT USAGE ON PROCEDURE CREATE_ACTION_ITEM(VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMBER, VARCHAR, VARCHAR, DATE, VARCHAR, VARCHAR) TO ROLE AMZ_FIN_APP;
GRANT USAGE ON PROCEDURE UPDATE_ACTION_ITEM(VARCHAR, VARCHAR, VARCHAR, NUMBER, VARCHAR) TO ROLE AMZ_FIN_APP;
GRANT USAGE ON PROCEDURE ACCEPT_RECOMMENDATION(VARCHAR, VARCHAR) TO ROLE AMZ_FIN_APP;
GRANT USAGE ON PROCEDURE DISMISS_RECOMMENDATION(VARCHAR, VARCHAR) TO ROLE AMZ_FIN_APP;
GRANT USAGE ON PROCEDURE SET_DASHBOARD_STATUS(VARCHAR, VARCHAR) TO ROLE AMZ_FIN_APP;
