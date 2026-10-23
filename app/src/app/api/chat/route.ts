import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent";
import { addMessage, createChat, listMessages } from "@/lib/db";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { chatId: existing, message } = (await req.json()) as { chatId?: string; message?: string };
  if (!message?.trim()) return Response.json({ error: "message required" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      // Persist what the UI renders under the answer; text and status are transient.
      const events: AgentEvent[] = [];
      const emit = (e: AgentEvent) => {
        if (e.type !== "text" && e.type !== "status") events.push(e);
        send(e);
      };
      let chatId = existing;

      try {
        const history = chatId
          ? (await listMessages(chatId)).slice(-12).map((m) => ({ role: m.role, content: m.content })).filter((m) => m.content)
          : [];
        chatId ??= await createChat(message.slice(0, 80));
        await addMessage(chatId, "user", message);

        send({ type: "status", text: "Thinking…" });
        const text = await runAgent(history, message, emit, req.signal);

        await addMessage(chatId, "assistant", text, events);
        send({ type: "done", text, chatId });
      } catch (err) {
        if ((err as Error).name !== "AbortError") send({ type: "error", text: (err as Error).message });
        if (chatId) send({ type: "done", text: "", chatId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
