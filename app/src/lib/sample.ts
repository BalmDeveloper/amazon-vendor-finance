import type { ActionItem, Automation, Insight, Metrics, Playbook, Recommendation } from "./types";

// Frontend-only preview data, shown with a "Sample data" badge when the
// insights and recommendations APIs are unavailable (e.g. Snowflake not configured yet).

// Figures from docs/plan.md (demo data, July 2021 – April 2025).
export const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "i1", generated_at: "2026-10-23T06:00:00Z", problem_area: "shortage_recovery", severity: "high",
    title: "Shortage deductions are barely being recovered",
    summary: "Amazon deducted $3.14M for shortages across 1,470 claims, while disputes recovered only $43.7K.",
    metric: "Shortage recovery rate", current_value: 1.4, comparison_value: 10, change_pct: null, related_entity: "1,470 claims",
  },
  {
    id: "i2", generated_at: "2026-10-23T06:00:00Z", problem_area: "unexplained_deductions", severity: "high",
    title: "$1.82M deducted with no description",
    summary: "595 claims carry the blank '-____-' label. Classifying them gives every deducted dollar a category and an owner.",
    metric: "Uncategorized deduction $", current_value: 1_820_000, comparison_value: 5_390_000, change_pct: null, related_entity: "595 claims",
  },
  {
    id: "i3", generated_at: "2026-10-23T06:00:00Z", problem_area: "cash_collection", severity: "medium",
    title: "$294K invoiced but unpaid",
    summary: "Collection rate is 97.1%. 60 invoices worth ~$150K are still processing or pending Amazon action.",
    metric: "Collection rate", current_value: 97.1, comparison_value: 98.5, change_pct: -1.4, related_entity: "60 invoices",
  },
  {
    id: "i4", generated_at: "2026-10-23T06:00:00Z", problem_area: "cash_collection", severity: "low",
    title: "$2.49M claimed but not yet deducted",
    summary: "Early warning: these claims are likely to become deductions on upcoming remittances.",
    metric: "Pending claims $", current_value: 2_490_000, comparison_value: null, change_pct: null,
  },
];

export const SAMPLE_RECOMMENDATIONS: Recommendation[] = [
  { id: "r1", insight_id: "i1", action_type: "dispute_shortage", entity_type: "claim_batch", entity_id: "Top 120 disputable",
    estimated_value_usd: 412_000, confidence: "medium", status: "new", expires_at: "2026-11-15",
    rationale: "120 shortage claims are still inside the dispute window and match a delivered PO. Filing them recovers the most value first." },
  { id: "r2", insight_id: "i2", action_type: "classify_deductions", entity_type: "claim_batch", entity_id: "595 unlabeled",
    estimated_value_usd: 180_000, confidence: "medium", status: "new",
    rationale: "Run AI_CLASSIFY on unlabeled lines; ~10% typically turn out to be disputable shortages or duplicate charges." },
  { id: "r3", insight_id: "i3", action_type: "chase_payment", entity_type: "invoice_batch", entity_id: "60 pending invoices",
    estimated_value_usd: 150_000, confidence: "high", status: "new", expires_at: "2026-11-01",
    rationale: "Invoices pending Amazon action for 30+ days. A Vendor Central case usually releases payment within two cycles." },
  { id: "r4", insight_id: "i1", action_type: "fix_root_cause", entity_type: "asin", entity_id: "Top 10 shortage ASINs",
    estimated_value_usd: 64_000, confidence: "low", status: "new",
    rationale: "Ten ASINs drive 38% of shortage dollars; check carton labels and ASN accuracy with the 3PL." },
];

export const OWNERS = ["Finance ops", "AR team", "Vendor manager", "Supply chain", "Me"];

export const SAMPLE_METRICS: Metrics = {
  shortage_recovery_rate_pct: 18.4,
  deduction_categorized_pct: 71.2,
  unpaid_over_60d_usd: 1_240_000,
  median_hours_to_action: 52,
  recovered_to_date_usd: 96_400,
};

export const SAMPLE_ACTION_ITEMS: ActionItem[] = [
  { id: "a1", title: "File disputes for 40 oldest shortage claims", owner: "Me", priority: "high",
    status: "open", due_date: "2026-10-22", action_type: "dispute_shortage", source: "recommendation" },
  { id: "a2", title: "Open Vendor Central case for pending invoices", owner: "AR team", priority: "medium",
    status: "in_progress", due_date: "2026-10-28", action_type: "chase_payment", source: "agent" },
  { id: "a3", title: "Review co-op agreement CO-2291 accruals", owner: "Me", priority: "low",
    status: "done", outcome_amount_usd: 12_800, action_type: "coop_review", source: "user" },
];

const STEPS_DISPUTE = [
  { id: "select", kind: "review" as const, title: "Pick claims", description: "Claims still inside the dispute window with a delivered PO." },
  { id: "assign", kind: "assign" as const, title: "Assign owner", description: "Who files the disputes, and by when." },
  { id: "confirm", kind: "confirm" as const, title: "Create action items", description: "One action item per claim, tracked to recovery." },
];

export const SAMPLE_PLAYBOOKS: Playbook[] = [
  {
    id: "shortage-dispute", title: "Shortage dispute", problem_area: "shortage_recovery", action_type: "dispute_shortage",
    summary: "Recover disputable shortage claims before the window closes.", estimated_value_usd: 412_000,
    rows: [
      { id: "SC-10481", label: "SC-10481 · PO 7741", detail: "Closes in 6 days", value_usd: 48_200 },
      { id: "SC-10477", label: "SC-10477 · PO 7702", detail: "Closes in 9 days", value_usd: 36_900 },
      { id: "SC-10455", label: "SC-10455 · PO 7688", detail: "Closes in 12 days", value_usd: 31_400 },
      { id: "SC-10432", label: "SC-10432 · PO 7650", detail: "Closes in 15 days", value_usd: 22_750 },
    ],
    steps: STEPS_DISPUTE,
  },
  {
    id: "unexplained-deductions", title: "Unexplained deductions", problem_area: "unexplained_deductions", action_type: "resolve_deduction",
    summary: "Confirm AI categories for unlabeled deductions and route them to an owner.", estimated_value_usd: 180_000,
    rows: [
      { id: "D-5521", label: "D-5521 · Likely duplicate charge", detail: "AI confidence: high", value_usd: 18_300 },
      { id: "D-5519", label: "D-5519 · Likely shortage", detail: "AI confidence: medium", value_usd: 14_100 },
      { id: "D-5504", label: "D-5504 · Likely co-op", detail: "AI confidence: medium", value_usd: 9_800 },
    ],
    steps: [
      { id: "select", kind: "review", title: "Confirm categories", description: "Keep the deductions whose AI category looks right." },
      { id: "assign", kind: "assign", title: "Route to owner", description: "Who resolves them, and by when." },
      { id: "confirm", kind: "confirm", title: "Create action items", description: "One action item per deduction." },
    ],
  },
  {
    id: "cash-collection", title: "Cash collection", problem_area: "cash_collection", action_type: "chase_payment",
    summary: "Chase invoices pending Amazon action for 30+ days.", estimated_value_usd: 150_000,
    rows: [
      { id: "INV-88120", label: "INV-88120", detail: "Pending 64 days", value_usd: 41_000 },
      { id: "INV-88094", label: "INV-88094", detail: "Pending 47 days", value_usd: 27_500 },
      { id: "INV-88051", label: "INV-88051", detail: "Pending 33 days", value_usd: 19_200 },
    ],
    steps: [
      { id: "select", kind: "review", title: "Pick invoices", description: "Invoices to chase in this round." },
      { id: "assign", kind: "assign", title: "Assign follow-up", description: "Who opens the Vendor Central case, and the follow-up date." },
      { id: "confirm", kind: "confirm", title: "Create action items", description: "One chase task per invoice." },
    ],
  },
];

export const SAMPLE_AUTOMATIONS: Automation[] = [
  { id: "weekly-digest", title: "Weekly finance digest", kind: "digest", channel: "slack", cadence: "weekly", enabled: true,
    description: "Money at stake, top 3 decisions and recovered-to-date, posted every Monday.",
    last_run_at: "2026-10-19T08:00:00Z", next_run_at: "2026-10-26T08:00:00Z" },
  { id: "large-deduction", title: "Large deduction alert", kind: "alert", channel: "email", cadence: "hourly", enabled: true,
    threshold_usd: 25_000, description: "Email the owner when a new deduction exceeds the threshold.",
    last_run_at: "2026-10-23T20:00:00Z", next_run_at: "2026-10-23T21:00:00Z" },
  { id: "insight-refresh", title: "Daily insight refresh", kind: "refresh", channel: "app", cadence: "daily", enabled: false,
    description: "Re-run detection rules and refresh recommendations each morning.",
    last_run_at: null, next_run_at: null },
];
