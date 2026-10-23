import "server-only";
import { randomUUID } from "crypto";
import { lower, query } from "./snowflake";
import type { ActionItem, ChartSpec, Chat, Dashboard, DashboardSpec, Message, Widget } from "./types";

// ---------- chats ----------
export async function listChats(): Promise<Chat[]> {
  return lower<Chat>(
    await query(
      "SELECT ID, TITLE, CREATED_AT, UPDATED_AT FROM CHATS ORDER BY UPDATED_AT DESC LIMIT 50",
    ),
  );
}

export async function createChat(title: string): Promise<string> {
  const id = randomUUID();
  await query("INSERT INTO CHATS (ID, TITLE) VALUES (?, ?)", [id, title]);
  return id;
}

export async function touchChat(id: string, sandboxId?: string) {
  await query(
    "UPDATE CHATS SET UPDATED_AT = CURRENT_TIMESTAMP(), SANDBOX_ID = COALESCE(?, SANDBOX_ID) WHERE ID = ?",
    [sandboxId ?? null, id],
  );
}

export async function deleteChat(id: string) {
  await query("DELETE FROM MESSAGES WHERE CHAT_ID = ?", [id]);
  await query("DELETE FROM CHATS WHERE ID = ?", [id]);
}

// ---------- messages ----------
export async function listMessages(chatId: string): Promise<Message[]> {
  const rows = lower<Message & { events: unknown }>(
    await query(
      "SELECT ID, CHAT_ID, ROLE, CONTENT, EVENTS, CREATED_AT FROM MESSAGES WHERE CHAT_ID = ? ORDER BY CREATED_AT",
      [chatId],
    ),
  );
  return rows.map((r) => ({
    ...r,
    events: typeof r.events === "string" ? JSON.parse(r.events) : (r.events ?? []),
  })) as Message[];
}

export async function addMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
  events: unknown[] = [],
): Promise<string> {
  const id = randomUUID();
  await query(
    "INSERT INTO MESSAGES (ID, CHAT_ID, ROLE, CONTENT, EVENTS) SELECT ?, ?, ?, ?, PARSE_JSON(?)",
    [id, chatId, role, content, JSON.stringify(events)],
  );
  return id;
}

// ---------- action items ----------
export async function listActionItems(): Promise<ActionItem[]> {
  return lower<ActionItem>(
    await query(
      "SELECT ID, CHAT_ID, TITLE, DETAIL, OWNER, PRIORITY, STATUS, TO_VARCHAR(DUE_DATE) AS DUE_DATE, CREATED_AT FROM ACTION_ITEMS ORDER BY STATUS, CREATED_AT DESC",
    ),
  );
}

export async function addActionItems(
  chatId: string | null,
  items: Omit<ActionItem, "id" | "chat_id" | "status" | "created_at">[],
): Promise<ActionItem[]> {
  const out: ActionItem[] = [];
  for (const it of items) {
    const id = randomUUID();
    await query(
      "INSERT INTO ACTION_ITEMS (ID, CHAT_ID, TITLE, DETAIL, OWNER, PRIORITY, DUE_DATE) VALUES (?, ?, ?, ?, ?, ?, TRY_TO_DATE(?))",
      [
        id,
        chatId,
        it.title,
        it.detail ?? null,
        it.owner ?? null,
        it.priority ?? "medium",
        it.due_date ?? null,
      ],
    );
    out.push({ ...it, id, chat_id: chatId, status: "open" });
  }
  return out;
}

const STATUSES = new Set(["open", "in_progress", "done"]);

export async function updateActionStatus(id: string, status: string) {
  if (!STATUSES.has(status)) throw new Error("invalid status");
  await query("UPDATE ACTION_ITEMS SET STATUS = ? WHERE ID = ?", [status, id]);
}

export async function deleteActionItem(id: string) {
  await query("DELETE FROM ACTION_ITEMS WHERE ID = ?", [id]);
}

// ---------- dashboards / widgets ----------
const DEFAULT_DASHBOARD = "default";

async function ensureDefaultDashboard() {
  await query(
    "MERGE INTO DASHBOARDS d USING (SELECT ? AS ID) s ON d.ID = s.ID WHEN NOT MATCHED THEN INSERT (ID, NAME) VALUES (s.ID, 'Pinned')",
    [DEFAULT_DASHBOARD],
  );
}

export async function listDashboards(): Promise<Dashboard[]> {
  await ensureDefaultDashboard();
  return lower<Dashboard>(
    await query(
      `SELECT d.ID, d.NAME, d.CREATED_AT, COUNT(w.ID) AS WIDGET_COUNT
       FROM DASHBOARDS d LEFT JOIN WIDGETS w ON w.DASHBOARD_ID = d.ID
       GROUP BY d.ID, d.NAME, d.CREATED_AT
       ORDER BY IFF(d.ID = ?, 0, 1), d.CREATED_AT DESC`,
      [DEFAULT_DASHBOARD],
    ),
  );
}

/** Creates a dashboard with all its widgets in one go (used by the build-dashboard skill). */
export async function createDashboard(chatId: string | null, spec: DashboardSpec): Promise<string> {
  const id = randomUUID();
  await query("INSERT INTO DASHBOARDS (ID, NAME) VALUES (?, ?)", [id, spec.name.slice(0, 120)]);
  let pos = 0;
  for (const w of spec.widgets.slice(0, 24)) {
    await query(
      "INSERT INTO WIDGETS (ID, DASHBOARD_ID, CHAT_ID, TITLE, SPEC, POSITION) SELECT ?, ?, ?, ?, PARSE_JSON(?), ?",
      [randomUUID(), id, chatId, w.title, JSON.stringify(w), ++pos],
    );
  }
  return id;
}

export async function deleteDashboard(id: string) {
  if (id === DEFAULT_DASHBOARD) throw new Error("cannot delete the pinned dashboard");
  await query("DELETE FROM WIDGETS WHERE DASHBOARD_ID = ?", [id]);
  await query("DELETE FROM DASHBOARDS WHERE ID = ?", [id]);
}

export async function listWidgets(dashboardId = DEFAULT_DASHBOARD): Promise<Widget[]> {
  const rows = lower<Widget & { spec: unknown }>(
    await query(
      "SELECT ID, DASHBOARD_ID, CHAT_ID, TITLE, SPEC, POSITION, CREATED_AT FROM WIDGETS WHERE DASHBOARD_ID = ? ORDER BY POSITION, CREATED_AT",
      [dashboardId],
    ),
  );
  return rows.map((r) => ({
    ...r,
    spec: typeof r.spec === "string" ? JSON.parse(r.spec) : r.spec,
  })) as Widget[];
}

export async function addWidget(chatId: string | null, spec: ChartSpec, dashboardId = DEFAULT_DASHBOARD) {
  if (dashboardId === DEFAULT_DASHBOARD) await ensureDefaultDashboard();
  const id = randomUUID();
  await query(
    "INSERT INTO WIDGETS (ID, DASHBOARD_ID, CHAT_ID, TITLE, SPEC, POSITION) SELECT ?, ?, ?, ?, PARSE_JSON(?), (SELECT COALESCE(MAX(POSITION), 0) + 1 FROM WIDGETS WHERE DASHBOARD_ID = ?)",
    [id, dashboardId, chatId, spec.title, JSON.stringify(spec), dashboardId],
  );
  return id;
}

export async function deleteWidget(id: string) {
  await query("DELETE FROM WIDGETS WHERE ID = ?", [id]);
}
