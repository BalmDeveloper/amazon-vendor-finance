import { NextRequest } from "next/server";
import { deleteChat, listMessages } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/chats/[id]">) {
  const { id } = await ctx.params;
  return Response.json(await listMessages(id));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/chats/[id]">) {
  const { id } = await ctx.params;
  await deleteChat(id);
  return Response.json({ ok: true });
}
