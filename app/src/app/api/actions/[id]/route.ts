import { NextRequest } from "next/server";
import { deleteActionItem, updateActionStatus } from "@/lib/db";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/actions/[id]">) {
  const { id } = await ctx.params;
  const { status } = await req.json();
  try {
    await updateActionStatus(id, status);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/actions/[id]">) {
  const { id } = await ctx.params;
  await deleteActionItem(id);
  return Response.json({ ok: true });
}
