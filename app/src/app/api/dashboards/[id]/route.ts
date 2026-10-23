import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { dashboardData, setDashboardStatus } from "@/lib/db";
import type { DashboardStatus } from "@/lib/types";

// GET /api/dashboards/<id> → every widget with live data, queried as the signed-in user
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/dashboards/[id]">) {
  const { id } = await ctx.params;
  return json(() => dashboardData(id));
}

// PATCH { status: "published" | "archived" | "draft" } → publish or archive (SET_DASHBOARD_STATUS)
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/dashboards/[id]">) {
  const { id } = await ctx.params;
  const { status } = (await req.json()) as { status?: DashboardStatus };
  return json(async () => {
    if (!status || !["draft", "published", "archived"].includes(status)) throw new Error("invalid status");
    return setDashboardStatus(id, status);
  });
}
