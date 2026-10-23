import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { updateActionItem } from "@/lib/db";
import type { ActionStatus } from "@/lib/types";

const STATUSES = new Set<ActionStatus>(["open", "in_progress", "done", "dismissed"]);

// PATCH { status?, owner?, outcome_amount_usd?, notes? } → UPDATE_ACTION_ITEM.
// Items are never deleted; "dismissed" takes them off the board.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/actions/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  return json(async () => {
    if (body.status && !STATUSES.has(body.status)) throw new Error("invalid status");
    return updateActionItem(id, {
      status: body.status,
      owner: body.owner,
      notes: body.notes,
      outcome_amount_usd: body.outcome_amount_usd == null ? null : Number(body.outcome_amount_usd),
    });
  });
}
