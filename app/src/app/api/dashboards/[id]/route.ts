import { NextRequest } from "next/server";
import { deleteDashboard } from "@/lib/db";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/dashboards/[id]">) {
  const { id } = await ctx.params;
  try {
    await deleteDashboard(id);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ ok: true });
}
