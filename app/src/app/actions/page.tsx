"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Circle, CircleCheck, CircleDot, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ActionItem, ActionStatus } from "@/lib/types";

type Column = Exclude<ActionStatus, "dismissed">;
const COLUMNS: { key: Column; label: string; icon: typeof Circle; tone: string }[] = [
  { key: "open", label: "To do", icon: Circle, tone: "text-muted-foreground" },
  { key: "in_progress", label: "In progress", icon: CircleDot, tone: "text-sky-600" },
  { key: "done", label: "Done", icon: CircleCheck, tone: "text-emerald-600" },
];
const NEXT: Record<Column, Column> = { open: "in_progress", in_progress: "done", done: "open" };
const PRIORITY: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground",
};
const usd = (v?: number | null) => (v == null ? "" : `$${Math.round(v).toLocaleString("en-US")}`);

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch("/api/actions").then(async (r) => {
      const body = await r.json();
      if (r.ok) setItems(body);
      else { setError(body.error ?? "Could not load action items"); setItems([]); }
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function update(id: string, patch: Partial<Pick<ActionItem, "status" | "outcome_amount_usd">>) {
    setItems((all) => all?.map((i) => (i.id === id ? { ...i, ...patch } : i)).filter((i) => i.status !== "dismissed") ?? null);
    const r = await fetch(`/api/actions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!r.ok) { setError((await r.json()).error ?? "Update failed"); load(); }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const r = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (r.ok) { setTitle(""); load(); } else setError((await r.json()).error ?? "Could not add the item");
  }

  const open = items?.filter((i) => i.status !== "done") ?? [];
  const atStake = open.reduce((s, i) => s + (i.amount_usd ?? 0), 0);
  const recovered = items?.reduce((s, i) => s + (i.outcome_amount_usd ?? 0), 0) ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-5">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><CheckSquare className="size-5" /> Action items</h1>
            <p className="text-sm text-muted-foreground">
              {items
                ? <>{open.length} open{atStake > 0 && <> · {usd(atStake)} at stake</>}{recovered > 0 && <> · <span className="text-emerald-700">{usd(recovered)} recovered</span></>}</>
                : "Follow-ups on shortages, deductions and cash collection"}
            </p>
          </div>
          <form onSubmit={add} className="flex w-full max-w-sm gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an action item…" />
            <Button type="submit" disabled={!title.trim()}><Plus /> Add</Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-6">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</div>}
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
                          <button onClick={() => update(i.id, { status: NEXT[col.key] })} aria-label="Advance status" className={`mt-0.5 ${col.tone} hover:text-foreground`}>
                            <col.icon className="size-4" />
                          </button>
                          <div className={`flex-1 text-sm font-medium ${i.status === "done" ? "text-muted-foreground line-through" : ""}`}>{i.title}</div>
                          <Button size="icon" variant="ghost" onClick={() => update(i.id, { status: "dismissed" })} aria-label="Dismiss" title="Dismiss"
                            className="size-6 text-muted-foreground opacity-0 group-hover:opacity-100">
                            <X />
                          </Button>
                        </div>
                        {i.notes && <p className="pl-6 text-xs text-muted-foreground line-clamp-2">{i.notes}</p>}
                        <div className="flex flex-wrap items-center gap-1.5 pl-6 text-xs">
                          <Badge variant="outline" className={PRIORITY[i.priority ?? "medium"]}>{i.priority ?? "medium"}</Badge>
                          {i.amount_usd != null && <span className="font-medium tabular-nums">{usd(i.amount_usd)}</span>}
                          {i.owner && <span className="text-muted-foreground">{i.owner}</span>}
                          {i.due_date && <span className="text-muted-foreground">· due {i.due_date}</span>}
                          {i.source === "agent" && <span className="text-muted-foreground">· from the assistant</span>}
                        </div>
                        {i.status === "done" && <Outcome item={i} onSave={(v) => update(i.id, { outcome_amount_usd: v })} />}
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

/** Records what a finished item actually recovered or collected. */
function Outcome({ item, onSave }: { item: ActionItem; onSave: (v: number) => void }) {
  const [value, setValue] = useState(item.outcome_amount_usd?.toString() ?? "");
  if (item.outcome_amount_usd != null && value === item.outcome_amount_usd.toString())
    return <div className="pl-6 text-xs text-emerald-700">Recovered {usd(item.outcome_amount_usd)}</div>;
  return (
    <form className="flex items-center gap-2 pl-6" onSubmit={(e) => { e.preventDefault(); if (value !== "" && !isNaN(Number(value))) onSave(Number(value)); }}>
      <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="Amount recovered ($)" className="h-7 text-xs" />
      <Button size="sm" variant="outline" className="h-7" type="submit" disabled={value === "" || isNaN(Number(value))}>Save</Button>
    </form>
  );
}
