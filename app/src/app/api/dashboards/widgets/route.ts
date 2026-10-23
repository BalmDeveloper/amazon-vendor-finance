import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { addWidget, createDashboard } from "@/lib/db";
import type { ChartConfig } from "@/lib/types";

type Body = {
  dashboardId?: string;
  widget?: { type: string; title: string; description?: string; sql: string; config: ChartConfig };
};

// POST { dashboardId?, widget } → saves a chat chart's query as a live widget; without a
// dashboardId, creates a new draft dashboard for it first. ADD_WIDGET validates the query.
export async function POST(req: NextRequest) {
  const { dashboardId, widget } = (await req.json()) as Body;
  return json(async () => {
    if (!widget?.title || !widget.sql) throw new Error("widget with title and sql required");
    const id = dashboardId ?? (await createDashboard(widget.title, null, null));
    const r = await addWidget(id, widget);
    return { dashboardId: id, widgetId: r.widget_id };
  });
}
