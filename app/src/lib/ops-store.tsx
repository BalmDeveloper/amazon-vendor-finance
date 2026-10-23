"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SAMPLE_ACTION_ITEMS, SAMPLE_INSIGHTS, SAMPLE_METRICS, SAMPLE_RECOMMENDATIONS } from "./sample";
import { humanize } from "./format";
import type { ActionItem, Insight, Metrics, Recommendation } from "./types";

/**
 * Shared client state for the decision loop: insights → recommendations → action items → outcomes.
 * Every write is optimistic and rolls back on failure. When the platform APIs are unavailable the
 * store runs in sample mode, so the whole flow can be tried end-to-end without Snowflake.
 * API contract: see ARCHITECTURE.md ("Decision loop API").
 */

export type AcceptInput = { owner: string; due_date?: string | null; note?: string };

type OpsState = {
  ready: boolean;
  sample: boolean;
  insights: Insight[];
  recommendations: Recommendation[];
  items: ActionItem[];
  metrics: Metrics;
  accept: (recs: Recommendation[], input: AcceptInput) => Promise<boolean>;
  dismiss: (recs: Recommendation[], reason?: string) => Promise<boolean>;
  updateItems: (ids: string[], patch: Partial<ActionItem>) => Promise<boolean>;
  createItems: (items: Omit<ActionItem, "id" | "chat_id" | "status">[]) => Promise<boolean>;
  removeItem: (id: string) => Promise<boolean>;
  reload: () => void;
};

const Ctx = createContext<OpsState | null>(null);

const json = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const getJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return r.json();
};
const tmpId = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;

export function OpsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sample, setSample] = useState(false);
  // Action items have their own API; they can be live even while insights are still sample data.
  const [itemsLive, setItemsLive] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecs] = useState<Recommendation[]>([]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [serverMetrics, setServerMetrics] = useState<Metrics | null>(null);

  const reload = useCallback(() => {
    // Action items already have an API; insights/recommendations/metrics are platform endpoints.
    Promise.allSettled([
      getJson<Insight[]>("/api/insights"),
      getJson<Recommendation[]>("/api/recommendations"),
      getJson<ActionItem[]>("/api/actions"),
      getJson<Metrics>("/api/metrics"),
    ]).then(([ins, rec, act, met]) => {
      const live = ins.status === "fulfilled" && rec.status === "fulfilled";
      setSample(!live);
      setInsights(ins.status === "fulfilled" ? ins.value : SAMPLE_INSIGHTS);
      setRecs(rec.status === "fulfilled" ? rec.value : SAMPLE_RECOMMENDATIONS);
      setItemsLive(act.status === "fulfilled");
      setItems(act.status === "fulfilled" ? act.value : live ? [] : SAMPLE_ACTION_ITEMS);
      setServerMetrics(met.status === "fulfilled" ? met.value : null);
      setReady(true);
    });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Recovered-to-date reflects outcomes recorded in this session, even before the server recomputes.
  const metrics = useMemo<Metrics>(() => {
    const base = serverMetrics ?? SAMPLE_METRICS;
    if (serverMetrics) return base;
    const extra = items
      .filter((i) => i.status === "done" && i.outcome_amount_usd && !SAMPLE_ACTION_ITEMS.some((s) => s.id === i.id))
      .reduce((s, i) => s + (i.outcome_amount_usd ?? 0), 0);
    return { ...base, recovered_to_date_usd: base.recovered_to_date_usd + extra };
  }, [serverMetrics, items]);

  const accept = useCallback<OpsState["accept"]>(async (recs, input) => {
    const ids = new Set(recs.map((r) => r.id));
    const beforeRecs = recommendations;
    const beforeItems = items;
    const created: ActionItem[] = recs.map((r) => ({
      id: tmpId(), chat_id: null, status: "open", priority: r.estimated_value_usd >= 100_000 ? "high" : "medium",
      title: `${humanize(r.action_type)}${r.entity_id ? `: ${r.entity_id}` : ""}`,
      detail: input.note || r.rationale, owner: input.owner, due_date: input.due_date ?? null,
      action_type: r.action_type, source: "recommendation", recommendation_id: r.id,
    }));
    setRecs((all) => all.map((r) => (ids.has(r.id) ? { ...r, status: "accepted", action_item_id: created.find((c) => c.recommendation_id === r.id)?.id } : r)));
    setItems((all) => [...created, ...all]);
    if (sample) return true;
    const results = await Promise.all(
      recs.map((r) => fetch(`/api/recommendations/${encodeURIComponent(r.id)}`, { method: "POST", ...json({ action: "accept", ...input }) })),
    );
    if (results.some((r) => !r.ok)) {
      setRecs(beforeRecs); setItems(beforeItems);
      toast.error("Couldn't accept. Nothing was changed.");
      return false;
    }
    reload();
    return true;
  }, [recommendations, items, sample, reload]);

  const dismiss = useCallback<OpsState["dismiss"]>(async (recs, reason) => {
    const ids = new Set(recs.map((r) => r.id));
    const before = recommendations;
    setRecs((all) => all.map((r) => (ids.has(r.id) ? { ...r, status: "dismissed" } : r)));
    if (sample) return true;
    const results = await Promise.all(
      recs.map((r) => fetch(`/api/recommendations/${encodeURIComponent(r.id)}`, { method: "POST", ...json({ action: "dismiss", reason }) })),
    );
    if (results.some((r) => !r.ok)) { setRecs(before); toast.error("Couldn't dismiss. Try again."); return false; }
    return true;
  }, [recommendations, sample]);

  const updateItems = useCallback<OpsState["updateItems"]>(async (ids, patch) => {
    const set = new Set(ids);
    const before = items;
    setItems((all) => all.map((i) => (set.has(i.id) ? { ...i, ...patch } : i)));
    if (!itemsLive) return true;
    const r = ids.length === 1
      ? await fetch(`/api/actions/${ids[0]}`, { method: "PATCH", ...json(patch) })
      : await fetch("/api/actions/bulk", { method: "PATCH", ...json({ ids, patch }) });
    if (!r.ok) { setItems(before); toast.error("Couldn't update. Try again."); return false; }
    return true;
  }, [items, itemsLive]);

  const createItems = useCallback<OpsState["createItems"]>(async (newItems) => {
    const created: ActionItem[] = newItems.map((i) => ({ ...i, id: tmpId(), chat_id: null, status: "open" }));
    const before = items;
    setItems((all) => [...created, ...all]);
    if (!itemsLive) return true;
    const results = await Promise.all(newItems.map((i) => fetch("/api/actions", { method: "POST", ...json(i) })));
    if (results.some((r) => !r.ok)) { setItems(before); toast.error("Couldn't create the action items."); return false; }
    reload();
    return true;
  }, [items, itemsLive, reload]);

  const removeItem = useCallback<OpsState["removeItem"]>(async (id) => {
    const before = items;
    setItems((all) => all.filter((i) => i.id !== id));
    if (!itemsLive) return true;
    const r = await fetch(`/api/actions/${id}`, { method: "DELETE" });
    if (!r.ok) { setItems(before); toast.error("Couldn't delete the item"); return false; }
    return true;
  }, [items, itemsLive]);

  const value = useMemo(
    () => ({ ready, sample, insights, recommendations, items, metrics, accept, dismiss, updateItems, createItems, removeItem, reload }),
    [ready, sample, insights, recommendations, items, metrics, accept, dismiss, updateItems, createItems, removeItem, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOps() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOps must be used inside OpsProvider");
  return v;
}
