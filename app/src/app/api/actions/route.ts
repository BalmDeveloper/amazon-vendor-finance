import { connection, NextRequest } from "next/server";
import { addActionItems, listActionItems } from "@/lib/db";

export async function GET() {
  await connection();
  return Response.json(await listActionItems());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.title) return Response.json({ error: "title required" }, { status: 400 });
  const [item] = await addActionItems(body.chat_id ?? null, [
    {
      title: String(body.title).slice(0, 200),
      detail: body.detail ?? null,
      owner: body.owner ?? null,
      priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
      due_date: body.due_date ?? null,
    },
  ]);
  return Response.json(item);
}
