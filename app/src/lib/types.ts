export type Chat = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChartSpec = {
  type: "bar" | "line" | "area" | "pie" | "table" | "kpi" | "html";
  title: string;
  xKey?: string;
  yKeys?: string[];
  data: Record<string, string | number | null>[];
  unit?: string;
  description?: string;
  /** Widget width on the dashboard grid (1–3 columns). */
  span?: 1 | 2 | 3;
  /** type "html": self-contained snippet rendered in a sandboxed iframe. */
  html?: string;
  height?: number;
  /** shadcn-style variants: line/area → natural | linear | step | dots | labels | gradient; bar → horizontal | stacked | labels; pie → donut | labels */
  variant?: "natural" | "linear" | "step" | "dots" | "labels" | "gradient" | "horizontal" | "stacked" | "donut";
  /** Card footer, e.g. { value: 5.2, label: "this month" } → "Trending up by 5.2% this month" */
  trend?: { value: number; label?: string };
  footnote?: string;
};

export type DashboardSpec = {
  name: string;
  description?: string;
  widgets: ChartSpec[];
};

export type Dashboard = { id: string; name: string; created_at: string; widget_count: number };

export type ActionItem = {
  id: string;
  chat_id: string | null;
  title: string;
  detail?: string | null;
  owner?: string | null;
  priority?: "low" | "medium" | "high";
  status: "open" | "in_progress" | "done";
  due_date?: string | null;
  created_at?: string;
};

/** Events streamed from the sandbox agent and persisted on assistant messages. */
export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input?: unknown }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "chart"; spec: ChartSpec }
  | { type: "dashboard"; id: string; name: string; widgets: number }
  | { type: "action_items"; items: ActionItem[] }
  | { type: "error"; text: string }
  | { type: "done"; text: string; chatId: string };

export type Message = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  events: AgentEvent[];
  created_at: string;
};

export type Widget = {
  id: string;
  dashboard_id: string;
  chat_id: string | null;
  title: string;
  spec: ChartSpec;
  position: number;
};

/** MARTS.INSIGHTS row (see docs/plan.md, App interface). */
export type Insight = {
  id: string;
  generated_at: string;
  problem_area: "shortage_recovery" | "unexplained_deductions" | "cash_collection" | string;
  severity: "high" | "medium" | "low";
  title: string;
  summary: string;
  metric: string;
  current_value: number | null;
  comparison_value: number | null;
  change_pct: number | null;
  evidence_sql?: string | null;
  related_entity?: string | null;
};

/** MARTS.RECOMMENDED_ACTIONS row (see docs/plan.md, App interface). */
export type Recommendation = {
  id: string;
  insight_id: string | null;
  action_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  estimated_value_usd: number;
  confidence: number; // 0–1
  rationale: string;
  status: "new" | "accepted" | "dismissed";
  expires_at?: string | null;
};
