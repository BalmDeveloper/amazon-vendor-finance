import { connection, NextRequest } from "next/server";
import { json } from "@/lib/api";
import { createActionItem, listActionItems } from "@/lib/db";

export async function GET() {
  await connection();
  return json(listActionItems);
}

// POST { title, notes?, owner?, priority?, due_date?, amount_usd? } → CREATE_ACTION_ITEM
export async function POST(req: NextRequest) {
  const body = await req.json();
  return json(async () => {
    if (!body?.title) throw new Error("title required");
    const id = await createActionItem({
      title: String(body.title).slice(0, 200),
      notes: body.notes ?? null,
      owner: body.owner ?? null,
      priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
      due_date: body.due_date ?? null,
      amount_usd: body.amount_usd == null ? null : Number(body.amount_usd),
    });
    return { id };
  });
}
