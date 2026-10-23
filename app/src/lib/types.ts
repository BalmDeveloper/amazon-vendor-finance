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
  /** The query that produced the data; lets a chat chart be saved as a live dashboard widget. */
  sql?: string;
};

/** How a stored widget maps its query columns to a chart (OPS.DASHBOARD_WIDGETS.CHART_CONFIG). */
export type ChartConfig = {
  x?: string;
  y?: string[];
  format?: "usd" | "percent" | "number";
  span?: 1 | 2 | 3;
  variant?: ChartSpec["variant"];
};

export type DashboardStatus = "draft" | "published" | "archived";

export type Dashboard = {
  id: string;
  title: string;
  description: string | null;
  business_problem: string | null;
  status: DashboardStatus;
  created_by: string;
  created_via: string;
  updated_at: string;
  widget_count: number;
  mine: boolean;
};

/** A widget rendered with live data, or the error its query raised. */
export type WidgetData = {
  id: string;
  position: number;
  spec: ChartSpec;
  error?: string;
};

export type ActionStatus = "open" | "in_progress" | "done" | "dismissed";

export type ActionItem = {
  id: string;
  title: string;
  action_type?: string;
  notes?: string | null;
  owner?: string | null;
  priority?: "low" | "medium" | "high";
  status: ActionStatus;
  due_date?: string | null;
  amount_usd?: number | null;
  outcome_amount_usd?: number | null;
  source?: string;
  created_at?: string;
};

export type Insight = {
  id: string;
  business_problem: string;
  severity: string;
  title: string;
  summary: string | null;
  current_value: number | null;
  change_pct: number | null;
  dashboard_id: string | null;
  generated_at: string;
};

export type Recommendation = {
  id: string;
  title: string;
  rationale: string | null;
  action_type: string;
  estimated_value_usd: number | null;
  confidence: number | null;
  created_at: string;
};

/** Events streamed to the chat UI and persisted on assistant messages. */
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
