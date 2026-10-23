import "server-only";
import { plainRows, widgetChart } from "./charts";
import { callProc, json, sql, sqlLongRaw, type ProcResult } from "./snowflake";
import type { ActionItem, ActionStatus, ChartConfig, Chat, Dashboard, DashboardStatus, Insight, Message, Recommendation, WidgetData } from "./types";

// All reads run as the signed-in user; all writes go through owner's-rights procedures,
// which validate input and record CURRENT_USER().

function ok(r: ProcResult): ProcResult {
  if (!r?.ok) throw new Error(r?.error ?? "Request failed");
  return r;
}

const parse = <T>(v: unknown, fallback: T): T => (typeof v === "string" ? JSON.parse(v) : (v ?? fallback)) as T;

// ---------- chats ----------
export async function listChats(): Promise<Chat[]> {
  return sql<Chat>(
    "SELECT chat_id AS id, title, created_at, updated_at FROM AMAZON_FINANCE_APP.APP.MY_CHATS ORDER BY updated_at DESC LIMIT 50",
  );
}

export async function createChat(title: string): Promise<string> {
  return String(ok(await callProc("AMAZON_FINANCE_APP.APP.CREATE_CHAT", [title])).chat_id);
}

export async function deleteChat(id: string) {
  ok(await callProc("AMAZON_FINANCE_APP.APP.DELETE_CHAT", [id]));
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const rows = await sql<Message & { events: unknown }>(
    `SELECT message_id AS id, chat_id, role, content, events, created_at
       FROM AMAZON_FINANCE_APP.APP.MY_MESSAGES WHERE chat_id = ? ORDER BY created_at, message_id`,
    [chatId],
  );
  return rows.map((r) => ({ ...r, content: r.content ?? "", events: parse(r.events, []) }));
}

export async function addMessage(chatId: string, role: "user" | "assistant", content: string, events: unknown[] = []) {
  ok(await callProc("AMAZON_FINANCE_APP.APP.SAVE_MESSAGE", [chatId, role, content, JSON.stringify(events)]));
}

// ---------- dashboards ----------
/** Published dashboards plus the user's own drafts. */
export async function listDashboards(): Promise<Dashboard[]> {
  const rows = await sql<Dashboard & { mine: unknown }>(
    `SELECT d.dashboard_id AS id, d.title, d.description, d.business_problem, d.status, d.created_by, d.created_via,
            d.updated_at, COUNT(w.widget_id) AS widget_count, d.created_by = CURRENT_USER() AS mine
       FROM AMAZON_FINANCE_APP.OPS.DASHBOARDS d
       LEFT JOIN AMAZON_FINANCE_APP.OPS.DASHBOARD_WIDGETS w ON w.dashboard_id = d.dashboard_id
      WHERE d.status = 'published' OR (d.status = 'draft' AND d.created_by = CURRENT_USER())
      GROUP BY ALL
      ORDER BY IFF(d.status = 'published', 0, 1), d.updated_at DESC`,
  );
  return rows.map((r) => ({ ...r, widget_count: Number(r.widget_count), mine: Boolean(r.mine) }));
}

type WidgetRow = {
  widget_id: string;
  position: number;
  widget_type: string;
  title: string;
  description: string | null;
  query_sql: string;
  chart_config: unknown;
};

/** Runs every widget's stored query as the signed-in user, in parallel; one failure doesn't break the rest. */
export async function dashboardData(dashboardId: string): Promise<WidgetData[]> {
  const widgets = await sql<WidgetRow>(
    `SELECT w.widget_id, w.position, w.widget_type, w.title, w.description, w.query_sql, w.chart_config
       FROM AMAZON_FINANCE_APP.OPS.DASHBOARD_WIDGETS w
       JOIN AMAZON_FINANCE_APP.OPS.DASHBOARDS d ON d.dashboard_id = w.dashboard_id
      WHERE w.dashboard_id = ? AND (d.status = 'published' OR d.created_by = CURRENT_USER())
      ORDER BY w.position`,
    [dashboardId],
  );
  return Promise.all(
    widgets.map(async (w) => {
      const meta = { ...w, chart_config: parse<ChartConfig | null>(w.chart_config, null) };
      try {
        const rows = plainRows(await sqlLongRaw(w.query_sql.replace(/;\s*$/, "")));
        return { id: w.widget_id, position: Number(w.position), spec: widgetChart(meta, rows) };
      } catch (e) {
        return {
          id: w.widget_id,
          position: Number(w.position),
          spec: widgetChart(meta, []),
          error: (e as Error).message,
        };
      }
    }),
  );
}

export async function setDashboardStatus(id: string, status: DashboardStatus) {
  return ok(await callProc("AMAZON_FINANCE_APP.OPS.SET_DASHBOARD_STATUS", [id, status]));
}

export async function createDashboard(title: string, description: string | null, sourceQuestion: string | null) {
  const r = ok(await callProc("AMAZON_FINANCE_APP.OPS.CREATE_DASHBOARD", [title, description, "general", sourceQuestion, "user"]));
  return String(r.dashboard_id);
}

/** Saves a chart from chat as a live widget (ADD_WIDGET validates the query). */
export async function addWidget(dashboardId: string, w: { type: string; title: string; description?: string; sql: string; config: ChartConfig }) {
  return ok(
    await callProc("AMAZON_FINANCE_APP.OPS.ADD_WIDGET", [
      dashboardId,
      w.type,
      w.title,
      w.description ?? null,
      w.sql,
      json(w.config),
    ]),
  );
}

// ---------- action items ----------
export async function listActionItems(): Promise<ActionItem[]> {
  const rows = await sql<ActionItem>(
    `SELECT action_item_id AS id, title, action_type, notes, owner, priority, status, TO_VARCHAR(due_date) AS due_date,
            amount_usd, outcome_amount_usd, source, created_at
       FROM AMAZON_FINANCE_APP.OPS.ACTION_ITEMS
      WHERE status <> 'dismissed'
      ORDER BY IFF(status = 'done', 1, 0), DECODE(priority, 'high', 0, 'medium', 1, 2), due_date NULLS LAST, created_at DESC`,
  );
  return rows.map((r) => ({
    ...r,
    amount_usd: r.amount_usd == null ? null : Number(r.amount_usd),
    outcome_amount_usd: r.outcome_amount_usd == null ? null : Number(r.outcome_amount_usd),
  }));
}

export async function createActionItem(i: { title: string; notes?: string | null; owner?: string | null; priority?: string; due_date?: string | null; amount_usd?: number | null }) {
  const r = ok(
    await callProc("AMAZON_FINANCE_APP.OPS.CREATE_ACTION_ITEM", [
      "other",
      i.title,
      null,
      null,
      i.amount_usd ?? null,
      i.priority ?? "medium",
      i.owner ?? null,
      i.due_date ?? null,
      i.notes ?? null,
      "user",
    ]),
  );
  return String(r.action_item_id);
}

export async function updateActionItem(id: string, u: { status?: ActionStatus; owner?: string | null; outcome_amount_usd?: number | null; notes?: string | null }) {
  return ok(
    await callProc("AMAZON_FINANCE_APP.OPS.UPDATE_ACTION_ITEM", [id, u.status ?? null, u.owner ?? null, u.outcome_amount_usd ?? null, u.notes ?? null]),
  );
}

// ---------- insights & recommendations ----------
export async function listInsights(): Promise<Insight[]> {
  return sql<Insight>(
    `SELECT insight_id AS id, business_problem, severity, title, summary, current_value, change_pct, dashboard_id, generated_at
       FROM AMAZON_FINANCE_APP.OPS.INSIGHTS
      WHERE status = 'active'
      ORDER BY DECODE(severity, 'high', 0, 'medium', 1, 2), generated_at DESC LIMIT 50`,
  );
}

export async function listRecommendations(): Promise<Recommendation[]> {
  const rows = await sql<Recommendation>(
    `SELECT recommendation_id AS id, title, rationale, action_type, estimated_value_usd, confidence, created_at
       FROM AMAZON_FINANCE_APP.OPS.RECOMMENDED_ACTIONS
      WHERE status = 'new' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP())
      ORDER BY estimated_value_usd DESC NULLS LAST LIMIT 50`,
  );
  return rows.map((r) => ({ ...r, estimated_value_usd: r.estimated_value_usd == null ? null : Number(r.estimated_value_usd) }));
}

export async function acceptRecommendation(id: string) {
  return ok(await callProc("AMAZON_FINANCE_APP.OPS.ACCEPT_RECOMMENDATION", [id, null]));
}

export async function dismissRecommendation(id: string, reason: string | null) {
  return ok(await callProc("AMAZON_FINANCE_APP.OPS.DISMISS_RECOMMENDATION", [id, reason]));
}
