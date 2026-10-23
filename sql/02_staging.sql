-- 02_staging.sql: clean views over the shared Amazon tables.
-- Every downstream object reads these views, never the share directly,
-- so a provider schema change is fixed here only.
-- Run as AMZ_FIN_ADMIN. Safe to re-run.

USE ROLE AMZ_FIN_ADMIN;
USE WAREHOUSE AMZ_FIN_WH;
USE SCHEMA AMAZON_FINANCE_APP.STAGING;

-- One row per vendor invoice
CREATE OR REPLACE VIEW STG_INVOICES COMMENT = 'Vendor invoices submitted to Amazon' AS
SELECT
    "invoice_number"            AS invoice_number,
    "invoice_date"::DATE        AS invoice_date,
    "payment_due_date"::DATE    AS payment_due_date,
    "invoice_status"            AS invoice_status,
    SPLIT_PART("invoice_status", ',', 1) AS invoice_status_group,
    "invoice_source"            AS invoice_source,
    "payee"                     AS payee,
    "marketplace"               AS marketplace,
    "invoice_amount"::NUMBER(18,2)      AS invoice_amount,
    "actual_paid_amount"::NUMBER(18,2)  AS paid_amount,
    ("invoice_amount" - "actual_paid_amount")::NUMBER(18,2) AS unpaid_amount,
    "quantity_variance"::NUMBER(18,2)   AS quantity_variance,
    "price_variance"::NUMBER(18,2)      AS price_variance,
    "quick_pay_discount"::NUMBER(18,2)  AS quick_pay_discount,
    "queued_for_payment"::NUMBER(18,2)  AS queued_for_payment,
    "list_of_pos"               AS po_list
FROM AMAZON_VENDOR_PL_FINANCE_REMITTANCE_AND_INVOICES_DEMO_DATASET.PUBLIC."invoices_summaryv2";

-- One row per remittance line, with a business category.
-- Provisions are reserves Amazon holds back and later releases (the -R lines);
-- they are tracked separately and never counted as deductions.
CREATE OR REPLACE VIEW STG_REMITTANCE_LINES COMMENT = 'Remittance lines with business categories and flags' AS
SELECT
    "id"                        AS line_id,
    "payment_number"            AS payment_number,
    "invoice_number"            AS reference_number,
    REGEXP_SUBSTR("invoice_number", '^[0-9a-f]+') AS base_invoice_number,
    "invoice_date"::DATE        AS line_date,
    "description"               AS raw_description,
    CASE
        WHEN "description" = '/____/'                        THEN 'Invoice payment'
        WHEN "description" LIKE 'PROVISION%'                 THEN 'Provision (reserve)'
        WHEN "description" = 'Shortage Claim'                THEN 'Shortage'
        WHEN "description" IN ('-____-', '____-')            THEN 'Unlabeled'
        WHEN "description" = 'Damage Allowance'              THEN 'Damage allowance'
        WHEN "description" = 'AVS - SVS'                     THEN 'Vendor services (AVS/SVS)'
        WHEN "description" = 'Missed Adjustment Claim'       THEN 'Missed adjustment'
        WHEN "description" = 'Coop Advertising'              THEN 'Co-op'
        WHEN "description" IN ('RETURNS', 'RETURN FREIGHT CHARGES') THEN 'Returns'
        WHEN "description" IN ('Ship In Own Container', 'Oversized Carton', 'Overweight Carton',
                               'Carton Content Accuracy', 'No carton/package', 'PREP',
                               'Pickup Accuracy', 'Rejected PO Rate') THEN 'Operational chargeback'
        WHEN "description" = 'Overcharges'                   THEN 'Overcharge'
        WHEN "description" = 'Payment made to vendor'        THEN 'Payment adjustment'
        ELSE 'Other'
    END                         AS category,
    ("description" LIKE 'PROVISION%')                       AS is_provision,
    ("description" = 'Shortage Claim')                      AS is_shortage,
    ("description" = '/____/')                              AS is_invoice_payment,
    ("invoice_amount" < 0 AND "description" <> '/____/'
        AND "description" NOT LIKE 'PROVISION%')            AS is_deduction,
    "invoice_amount"::NUMBER(18,2)      AS line_amount,
    "amount_paid"::NUMBER(18,2)         AS applied_amount,
    "remaining_amount"::NUMBER(18,2)    AS remaining_amount,
    "terms_discount_taken"::NUMBER(18,2) AS terms_discount,
    "invoice_currency"          AS currency
FROM AMAZON_VENDOR_PL_FINANCE_REMITTANCE_AND_INVOICES_DEMO_DATASET.PUBLIC."payments_invoices";

-- One row per deduction claim. A claim applied across several payments repeats
-- its full amount on every remittance line, so the claim amount is taken once
-- and the cash actually deducted is the sum of applied amounts.
-- Unlabeled lines have no reference number, so they are grouped by date + amount.
-- Amounts are positive (money Amazon took).
CREATE OR REPLACE VIEW STG_DEDUCTION_CLAIMS_RAW COMMENT = 'One row per Amazon deduction claim, source categories only' AS
SELECT
    COALESCE(reference_number,
             IFF(category = 'Unlabeled',
                 'UNL-' || TO_CHAR(line_date, 'YYYYMMDD') || '-' || TO_CHAR(-line_amount),
                 'LINE-' || line_id))               AS claim_id,
    ANY_VALUE(reference_number)                     AS reference_number,
    ANY_VALUE(base_invoice_number)                  AS base_invoice_number,
    category                                        AS source_category,
    ANY_VALUE(raw_description)                      AS raw_description,
    MIN(line_date)                                  AS claim_date,
    COUNT(DISTINCT payment_number)                  AS payments_applied,
    -MIN(line_amount)                               AS claim_amount,
    -SUM(applied_amount)                            AS deducted_amount,
    -MIN(line_amount) + SUM(applied_amount)         AS not_yet_applied_amount
FROM STG_REMITTANCE_LINES
WHERE is_deduction
GROUP BY 1, category;

-- Unlabeled deductions are co-op charges: they match a co-op invoice on exact
-- amount, typically 2 days after the co-op invoice date. Match each unlabeled
-- claim to at most one co-op invoice (closest date, one-to-one).
CREATE OR REPLACE VIEW STG_COOP_DEDUCTION_MATCH COMMENT = 'Unlabeled deduction claims matched to co-op invoices' AS
WITH candidates AS (
    SELECT d.claim_id, c.coop_invoice_id, c.agreement_title, c.funding_type,
           ABS(DATEDIFF('day', c.coop_date, d.claim_date)) AS lag_days
    FROM STG_DEDUCTION_CLAIMS_RAW d
    JOIN STG_COOP c
      ON ROUND(c.coop_amount, 2) = ROUND(d.claim_amount, 2)
     AND c.coop_date BETWEEN d.claim_date - 30 AND d.claim_date + 5
    WHERE d.source_category = 'Unlabeled'
),
best_per_claim AS (
    SELECT * FROM candidates
    QUALIFY ROW_NUMBER() OVER (PARTITION BY claim_id ORDER BY lag_days, coop_invoice_id) = 1
)
SELECT * FROM best_per_claim
QUALIFY ROW_NUMBER() OVER (PARTITION BY coop_invoice_id ORDER BY lag_days, claim_id) = 1;

-- Final claim view: source category, resolved category and how it was resolved.
CREATE OR REPLACE VIEW STG_DEDUCTION_CLAIMS COMMENT = 'One row per Amazon deduction claim (provisions excluded), with resolved category' AS
SELECT
    d.claim_id,
    d.reference_number,
    d.base_invoice_number,
    d.source_category,
    CASE WHEN m.coop_invoice_id IS NOT NULL THEN 'Co-op' ELSE d.source_category END AS category,
    CASE WHEN d.source_category <> 'Unlabeled' THEN 'Amazon label'
         WHEN m.coop_invoice_id IS NOT NULL    THEN 'Matched to co-op invoice'
         ELSE 'Unresolved' END                  AS category_method,
    m.coop_invoice_id,
    m.agreement_title                           AS coop_agreement_title,
    m.funding_type                              AS coop_funding_type,
    d.raw_description,
    d.claim_date,
    d.payments_applied,
    d.claim_amount,
    d.deducted_amount,
    d.not_yet_applied_amount
FROM STG_DEDUCTION_CLAIMS_RAW d
LEFT JOIN STG_COOP_DEDUCTION_MATCH m ON m.claim_id = d.claim_id;

-- One row per payment from Amazon
CREATE OR REPLACE VIEW STG_PAYMENTS COMMENT = 'Payments Amazon made to the vendor' AS
SELECT
    "payment_number"            AS payment_number,
    "payment_date"::DATE        AS payment_date,
    "payment_status"            AS payment_status,
    "payment_type"              AS payment_type,
    "amount_in_payment_currency"::NUMBER(18,2) AS payment_amount,
    "payment_currency"          AS currency
FROM AMAZON_VENDOR_PL_FINANCE_REMITTANCE_AND_INVOICES_DEMO_DATASET.PUBLIC."payments_payments";

-- One row per co-op charge
CREATE OR REPLACE VIEW STG_COOP COMMENT = 'Co-op charges billed by Amazon' AS
SELECT
    "invoice_id"                AS coop_invoice_id,
    "invoice_date"::DATE        AS coop_date,
    "agreement_id"              AS agreement_id,
    "agreement_title"           AS agreement_title,
    "funding_type"              AS funding_type,
    "original_balance"::NUMBER(18,2) AS coop_amount
FROM AMAZON_VENDOR_PL_FINANCE_REMITTANCE_AND_INVOICES_DEMO_DATASET.PUBLIC."payments_coop";

-- One row per disputed item. Only part of these link to a shortage claim's
-- invoice, so recovery is measured from this table directly.
CREATE OR REPLACE VIEW STG_DISPUTES COMMENT = 'Shortage disputes at item level, with outcome' AS
SELECT
    "dispute_id"                AS dispute_id,
    "dispute_date"::DATE        AS dispute_date,
    "invoice_number"            AS invoice_number,
    "po"                        AS po_number,
    "asin"                      AS asin,
    "title"                     AS product_title,
    NULLIF("dispute_decision", '') AS dispute_decision,
    COALESCE(NULLIF("dispute_decision", ''), 'Pending') AS dispute_status,
    "unit_price"::NUMBER(18,2)          AS unit_price,
    "shortage_quantity"         AS shortage_quantity,
    "shortage_amount"::NUMBER(18,2)     AS shortage_amount,
    "dispute_quantity"          AS dispute_quantity,
    "dispute_amount"::NUMBER(18,2)      AS dispute_amount,
    "resolved_amount"::NUMBER(18,2)     AS resolved_amount,
    "approved_quantity"         AS approved_quantity,
    "comments"                  AS comments
FROM AMAZON_VENDOR_PL_FINANCE_REMITTANCE_AND_INVOICES_DEMO_DATASET.PUBLIC."payments_dispute_management_details";

-- Cortex Analyst returns SQL over these views; the app re-runs that SQL for dashboard widgets
-- as the signed-in user, so readers need SELECT here (the same data the semantic view exposes).
GRANT USAGE ON SCHEMA AMAZON_FINANCE_APP.STAGING TO ROLE AMZ_FIN_USER;
GRANT SELECT ON ALL VIEWS IN SCHEMA AMAZON_FINANCE_APP.STAGING TO ROLE AMZ_FIN_USER;
GRANT SELECT ON FUTURE VIEWS IN SCHEMA AMAZON_FINANCE_APP.STAGING TO ROLE AMZ_FIN_USER;
