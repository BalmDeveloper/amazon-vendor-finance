"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useExternalStoreRuntime, type AppendMessage, type ThreadMessageLike } from "@assistant-ui/react";
import type { AgentEvent, Message } from "@/lib/types";

type Part = Exclude<ThreadMessageLike["content"], string>[number];
type Msg = ThreadMessageLike & { id: string };

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** UI tool names rendered by the chat toolkit (see toolkit.tsx). */
export const UI_TOOLS = { chart: "ui_chart", dashboard: "ui_dashboard", actions: "ui_action_items", error: "ui_error" } as const;

/**
 * Converts the backend's AgentEvent stream (and persisted events) into assistant-ui
 * message parts: agent tool calls stay tool-call parts; charts, dashboards and action
 * items become UI-only tool-call parts with their payload as the result.
 */
export function eventsToParts(events: AgentEvent[], text: string): Part[] {
  const parts: Part[] = [];
  for (const e of events) {
    if (e.type === "tool") {
      parts.push({ type: "tool-call", toolCallId: uid("t"), toolName: e.name, args: (e.input ?? {}) as never, result: { ok: true } });
    } else if (e.type === "chart") {
      parts.push({ type: "tool-call", toolCallId: uid("c"), toolName: UI_TOOLS.chart, args: {}, result: e.spec });
    } else if (e.type === "dashboard") {
      parts.push({ type: "tool-call", toolCallId: uid("d"), toolName: UI_TOOLS.dashboard, args: {}, result: e });
    } else if (e.type === "action_items") {
      parts.push({ type: "tool-call", toolCallId: uid("a"), toolName: UI_TOOLS.actions, args: {}, result: e.items });
    } else if (e.type === "error") {
      parts.push({ type: "tool-call", toolCallId: uid("e"), toolName: UI_TOOLS.error, args: {}, result: e.text });
    }
  }
  // Agent activity first, answer text, then rich results underneath.
  const isUi = (p: Part) => p.type === "tool-call" && Object.values(UI_TOOLS).includes(p.toolName as never);
  return [...parts.filter((p) => !isUi(p)), ...(text ? [{ type: "text" as const, text }] : []), ...parts.filter(isUi)];
}

export function fromStored(rows: Message[]): Msg[] {
  return rows.map((m) =>
    m.role === "user"
      ? { id: m.id, role: "user", content: [{ type: "text", text: m.content }] }
      : { id: m.id, role: "assistant", content: eventsToParts(m.events ?? [], m.content), status: { type: "complete", reason: "stop" } },
  );
}

export function useFinanceRuntime(opts: { chatId?: string; onChatId: (id: string) => void; onSettled: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("");
  const abort = useRef<AbortController | null>(null);
  const chatIdRef = useRef(opts.chatId);
  chatIdRef.current = opts.chatId;

  const onNew = useCallback(async (message: AppendMessage) => {
    const text = message.content.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
    if (!text) return;

    const assistantId = uid("m");
    const events: AgentEvent[] = [];
    let answer = "";
    const render = (running: boolean) =>
      setMessages((all) => all.map((m) => (m.id === assistantId
        ? { ...m, content: eventsToParts(events, answer), status: running ? { type: "running" } : { type: "complete", reason: "stop" } }
        : m)));

    setMessages((all) => [
      ...all,
      { id: uid("u"), role: "user", content: [{ type: "text", text }] },
      { id: assistantId, role: "assistant", content: [], status: { type: "running" } },
    ]);
    setIsRunning(true);
    setStatus("Connecting…");
    abort.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatIdRef.current, message: text }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const c of chunks) {
          if (!c.startsWith("data:")) continue;
          const ev = JSON.parse(c.slice(5)) as AgentEvent;
          if (ev.type === "status") setStatus(ev.text);
          else if (ev.type === "text") answer = ev.text;
          else if (ev.type === "done") {
            if (ev.text) answer = ev.text;
            if (ev.chatId) opts.onChatId(ev.chatId);
          } else if (ev.type !== "tool_result") events.push(ev);
          render(true);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") events.push({ type: "error", text: (e as Error).message });
    } finally {
      render(false);
      setIsRunning(false);
      setStatus("");
      opts.onSettled();
    }
  }, [opts]);

  // After an answer, suggest the next step toward a decision rather than more exploration.
  const followups = useMemo(() => {
    const last = messages.at(-1);
    if (isRunning || last?.role !== "assistant") return undefined;
    const parts = Array.isArray(last.content) ? last.content : [];
    const has = (tool: string) => parts.some((p) => p.type === "tool-call" && p.toolName === tool);
    const out: { title: string; prompt: string }[] = [];
    if (!has(UI_TOOLS.actions)) out.push({ title: "Turn this into action items", prompt: "Turn this into action items with owners, due dates and the dollars at stake." });
    if (has(UI_TOOLS.chart) && !has(UI_TOOLS.dashboard)) out.push({ title: "Build a dashboard", prompt: "Save this as a dashboard so I can track it weekly." });
    out.push({ title: "What's driving it?", prompt: "What is driving this? Show the top contributors and the evidence." });
    out.push({ title: "Summarize for my manager", prompt: "Summarize this in three bullets for my manager: what happened, the $ impact, and the decision needed." });
    return out;
  }, [messages, isRunning]);

  const runtime = useExternalStoreRuntime<Msg>({
    messages,
    isRunning,
    suggestions: followups,
    onNew,
    onCancel: async () => abort.current?.abort(),
    convertMessage: (m) => m,
  });

  return { runtime, setMessages, status };
}
