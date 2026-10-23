import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { deleteChat, listMessages } from "@/lib/db";

// Chats are private: MY_MESSAGES and DELETE_CHAT only see the signed-in user's own chats.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/chats/[id]">) {
  const { id } = await ctx.params;
  return json(() => listMessages(id));
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/chats/[id]">) {
  const { id } = await ctx.params;
  return json(async () => {
    await deleteChat(id);
    return { ok: true };
  });
}
