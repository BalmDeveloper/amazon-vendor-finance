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
