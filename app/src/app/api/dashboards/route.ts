import { connection, NextRequest } from "next/server";
import { addWidget, deleteWidget, listDashboards, listWidgets } from "@/lib/db";
import type { ChartSpec } from "@/lib/types";

// GET /api/dashboards           → list dashboards
// GET /api/dashboards?id=<id>   → widgets of one dashboard
export async function GET(req: NextRequest) {
  await connection();
  const id = req.nextUrl.searchParams.get("id");
  return Response.json(id ? await listWidgets(id) : await listDashboards());
}

// POST { chatId, spec, dashboardId? } → pin a chart (defaults to the "Pinned" dashboard)
export async function POST(req: NextRequest) {
  const { chatId, spec, dashboardId } = (await req.json()) as {
    chatId?: string;
    spec?: ChartSpec;
    dashboardId?: string;
  };
  if (!spec?.title || !(Array.isArray(spec.data) || typeof spec.html === "string")) {
    return Response.json({ error: "valid chart spec required" }, { status: 400 });
  }
  return Response.json({ id: await addWidget(chatId ?? null, spec, dashboardId) });
}

// DELETE ?widget=<id> → remove one widget
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("widget");
  if (!id) return Response.json({ error: "widget required" }, { status: 400 });
  await deleteWidget(id);
  return Response.json({ ok: true });
}
