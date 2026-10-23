import { NextRequest } from "next/server";
import { extractBlocks } from "@/lib/blocks";
import { addActionItems, addMessage, createChat, createDashboard, listMessages, touchChat } from "@/lib/db";
import { getChatSandbox, runAgentTurn } from "@/lib/sandbox";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { chatId: existing, message } = (await req.json()) as {
    chatId?: string;
    message?: string;
  };
  if (!message?.trim()) return Response.json({ error: "message required" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      const events: AgentEvent[] = [];
      let chatId = existing;

      try {
        const history = chatId
          ? (await listMessages(chatId)).slice(-12).map((m) => ({ role: m.role, content: m.content }))
          : [];
        chatId ??= await createChat(message.slice(0, 80));
        await addMessage(chatId, "user", message);

        send({ type: "status", text: "Starting sandbox…" });
        const sandbox = await getChatSandbox(chatId);
        send({ type: "status", text: "Thinking…" });

        let finalText = "";
        for await (const ev of runAgentTurn(sandbox, message, history, req.signal)) {
          if (ev.type === "final") {
            finalText = String(ev.text ?? "");
          } else if (ev.type === "tool") {
            const name = String(ev.name);
            const e: AgentEvent = { type: "tool", name, input: ev.input };
            events.push(e);
            send(e);
            if (name.includes("snowflake")) send({ type: "status", text: "Querying Snowflake Cortex Agent…" });
          } else if (ev.type === "text" || ev.type === "tool_result" || ev.type === "error") {
            const e = ev as unknown as AgentEvent;
            if (ev.type !== "text") events.push(e);
            send(e);
          }
        }

        const { text, charts, dashboards, actionItems } = extractBlocks(finalText);
        for (const spec of charts) {
          const e: AgentEvent = { type: "chart", spec };
          events.push(e);
          send(e);
        }
        for (const d of dashboards) {
          const id = await createDashboard(chatId, d);
          const e: AgentEvent = { type: "dashboard", id, name: d.name, widgets: d.widgets.length };
          events.push(e);
          send(e);
        }
        if (actionItems.length) {
          const saved = await addActionItems(chatId, actionItems);
          const e: AgentEvent = { type: "action_items", items: saved };
          events.push(e);
          send(e);
        }

        await addMessage(chatId, "assistant", text, events);
        await touchChat(chatId, sandbox.name);
        send({ type: "done", text, chatId });
      } catch (err) {
        send({ type: "error", text: (err as Error).message });
        if (chatId) send({ type: "done", text: "", chatId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
