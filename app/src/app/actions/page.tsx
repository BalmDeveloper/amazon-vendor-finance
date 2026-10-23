"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Circle, CircleCheck, CircleDot, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ActionItem } from "@/lib/types";

const COLUMNS: { key: ActionItem["status"]; label: string; icon: typeof Circle; tone: string }[] = [
  { key: "open", label: "To do", icon: Circle, tone: "text-muted-foreground" },
  { key: "in_progress", label: "In progress", icon: CircleDot, tone: "text-sky-600" },
  { key: "done", label: "Done", icon: CircleCheck, tone: "text-emerald-600" },
];
const NEXT: Record<ActionItem["status"], ActionItem["status"]> = { open: "in_progress", in_progress: "done", done: "open" };
const PRIORITY: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground",
};

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [title, setTitle] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(() => {
    fetch("/api/actions")
      .then(async (r) => (r.ok ? setItems(await r.json()) : (setUnavailable(true), setItems([]))))
      .catch(() => { setUnavailable(true); setItems([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: ActionItem["status"]) {
    setItems((all) => all?.map((i) => (i.id === id ? { ...i, status } : i)) ?? null);
    await fetch(`/api/actions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  }

  async function remove(id: string) {
    setItems((all) => all?.filter((i) => i.id !== id) ?? null);
    await fetch(`/api/actions/${id}`, { method: "DELETE" });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const r = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (r.ok) { setTitle(""); load(); }
  }

  const open = items?.filter((i) => i.status !== "done").length ?? 0;
  const high = items?.filter((i) => i.status !== "done" && i.priority === "high").length ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-5">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><CheckSquare className="size-5" /> Action items</h1>
            <p className="text-sm text-muted-foreground">
              {items ? <>{open} open{high > 0 && <> · <span className="text-red-600">{high} high priority</span></>}</> : "Follow-ups from your sales conversations"}
            </p>
          </div>
          <form onSubmit={add} className="flex w-full max-w-sm gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an action item…" disabled={unavailable} />
            <Button type="submit" disabled={!title.trim() || unavailable}><Plus /> Add</Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-6">
        {unavailable && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            Action items are stored in Snowflake. Connect it on the Integrations page to see and add items.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = items?.filter((i) => i.status === col.key) ?? [];
            return (
              <section key={col.key} className="rounded-xl bg-muted/50 p-3">
                <div className="mb-3 flex items-center gap-2 px-1 text-sm font-medium">
                  <col.icon className={`size-4 ${col.tone}`} /> {col.label}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {items === null && [0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
                  {items && list.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nothing here</p>}
                  {list.map((i) => (
                    <Card key={i.id} size="sm" className="group">
                      <CardContent className="space-y-2">
                        <div className="flex items-start gap-2">
                          <button onClick={() => setStatus(i.id, NEXT[i.status])} aria-label="Advance status" className={`mt-0.5 ${col.tone} hover:text-foreground`}>
                            <col.icon className="size-4" />
                          </button>
                          <div className={`flex-1 text-sm font-medium ${i.status === "done" ? "text-muted-foreground line-through" : ""}`}>{i.title}</div>
                          <Button size="icon" variant="ghost" onClick={() => remove(i.id)} aria-label="Delete"
                            className="size-6 text-muted-foreground opacity-0 group-hover:opacity-100">
                            <Trash2 />
                          </Button>
                        </div>
                        {i.detail && <p className="pl-6 text-xs text-muted-foreground line-clamp-2">{i.detail}</p>}
                        <div className="flex flex-wrap items-center gap-1.5 pl-6 text-xs">
                          <Badge variant="outline" className={PRIORITY[i.priority ?? "medium"]}>{i.priority ?? "medium"}</Badge>
                          {i.owner && <span className="text-muted-foreground">{i.owner}</span>}
                          {i.due_date && <span className="text-muted-foreground">· due {i.due_date}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
