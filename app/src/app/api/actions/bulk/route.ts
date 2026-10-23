import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { updateActionItem } from "@/lib/db";
import type { ActionStatus } from "@/lib/types";

const STATUSES = new Set<ActionStatus>(["open", "in_progress", "done", "dismissed"]);

// PATCH { ids: string[], patch: { status?, owner?, outcome_amount_usd?, notes? } } → UPDATE_ACTION_ITEM per id
export async function PATCH(req: NextRequest) {
  const { ids, patch } = (await req.json()) as { ids?: unknown; patch?: Record<string, unknown> };
  return json(async () => {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) throw new Error("ids must list 1–100 items");
    if (patch?.status && !STATUSES.has(patch.status as ActionStatus)) throw new Error("invalid status");
    const u = {
      status: patch?.status as ActionStatus | undefined,
      owner: patch?.owner as string | undefined,
      notes: patch?.notes as string | undefined,
      outcome_amount_usd: patch?.outcome_amount_usd == null ? null : Number(patch.outcome_amount_usd),
    };
    await Promise.all(ids.map((id) => updateActionItem(String(id), u)));
    return { updated: ids.length };
  });
}
