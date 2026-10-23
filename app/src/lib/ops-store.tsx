"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SAMPLE_ACTION_ITEMS, SAMPLE_INSIGHTS, SAMPLE_METRICS, SAMPLE_RECOMMENDATIONS } from "./sample";
import type { ActionItem, Insight, Metrics, Recommendation } from "./types";

/**
 * Shared client state for the decision loop: insights → recommendations → action items → outcomes.
 * Every write is optimistic and rolls back on failure. Insights and action items come from the
 * platform APIs (/api/insights, /api/actions); when those are unavailable (e.g. local dev without
 * Snowflake) the store runs in sample mode so the whole flow can still be tried.
 */

export type AcceptInput = { owner: string; due_date?: string | null; note?: string };
export type NewItem = Pick<ActionItem, "title" | "notes" | "owner" | "priority" | "due_date" | "amount_usd" | "action_type" | "source">;

type OpsState = {
  ready: boolean;
  /** Insights/recommendations are sample data. */
  sample: boolean;
  /** Success metrics other than recovered-to-date are sample values (no metrics API yet). */
  metricsSample: boolean;
  insights: Insight[];
  recommendations: Recommendation[];
  items: ActionItem[];
  metrics: Metrics;
  accept: (recs: Recommendation[], input: AcceptInput) => Promise<boolean>;
  dismiss: (recs: Recommendation[], reason?: string) => Promise<boolean>;
  updateItems: (ids: string[], patch: Partial<ActionItem>) => Promise<boolean>;
  createItems: (items: NewItem[]) => Promise<boolean>;
  reload: () => void;
};

const Ctx = createContext<OpsState | null>(null);

const post = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const getJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return r.json();
};
const tmpId = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;
// UPDATE_ACTION_ITEM accepts status, owner, outcome_amount_usd and notes.
const patchable = ({ status, owner, outcome_amount_usd, notes }: Partial<ActionItem>) => ({ status, owner, outcome_amount_usd, notes });

export function OpsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sample, setSample] = useState(false);
  const [itemsLive, setItemsLive] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecs] = useState<Recommendation[]>([]);
  const [items, setItems] = useState<ActionItem[]>([]);

  const reload = useCallback(() => {
    Promise.allSettled([
      getJson<{ insights: Insight[]; recommendations: Recommendation[] }>("/api/insights"),
      getJson<ActionItem[]>("/api/actions"),
    ]).then(([ins, act]) => {
      const live = ins.status === "fulfilled";
      setSample(!live);
      setInsights(live ? ins.value.insights : SAMPLE_INSIGHTS);
      setRecs(live ? ins.value.recommendations : SAMPLE_RECOMMENDATIONS);
      setItemsLive(act.status === "fulfilled");
      setItems(act.status === "fulfilled" ? act.value : live ? [] : SAMPLE_ACTION_ITEMS);
      setReady(true);
    });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Recovered-to-date is real whenever action items are live: the sum of recorded outcomes.
  const metrics = useMemo<Metrics>(() => {
    const recovered = items.reduce((s, i) => s + (i.outcome_amount_usd ?? 0), 0);
    return { ...SAMPLE_METRICS, recovered_to_date_usd: itemsLive ? recovered : SAMPLE_METRICS.recovered_to_date_usd - 12_800 + recovered };
  }, [items, itemsLive]);

  const accept = useCallback<OpsState["accept"]>(async (recs, input) => {
    const ids = new Set(recs.map((r) => r.id));
    const beforeRecs = recommendations;
    const beforeItems = items;
    const created: ActionItem[] = recs.map((r) => ({
      id: tmpId(), status: "open", priority: (r.estimated_value_usd ?? 0) >= 100_000 ? "high" : "medium",
      title: r.title, notes: input.note || r.rationale, owner: input.owner, due_date: input.due_date ?? null,
      amount_usd: r.estimated_value_usd, action_type: r.action_type, source: "recommendation", recommendation_id: r.id,
    }));
    setRecs((all) => all.map((r) => (ids.has(r.id) ? { ...r, status: "accepted" } : r)));
    setItems((all) => [...created, ...all]);
    if (sample) return true;

    // ACCEPT_RECOMMENDATION creates the action item; then hand it to the chosen owner.
    const results = await Promise.all(recs.map(async (r) => {
      const res = await post(`/api/recommendations/${encodeURIComponent(r.id)}`, { decision: "accept", owner: input.owner });
      if (!res.ok) return false;
      const { action_item_id } = (await res.json().catch(() => ({}))) as { action_item_id?: string };
      if (action_item_id && (input.owner || input.note)) {
        await post(`/api/actions/${encodeURIComponent(action_item_id)}`, { owner: input.owner, notes: input.note || undefined }, "PATCH");
      }
      return true;
    }));
    if (results.some((ok) => !ok)) {
      setRecs(beforeRecs); setItems(beforeItems);
      toast.error("Couldn't accept. Try again.");
      reload();
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
    const results = await Promise.all(recs.map((r) => post(`/api/recommendations/${encodeURIComponent(r.id)}`, { decision: "dismiss", reason })));
    if (results.some((r) => !r.ok)) { setRecs(before); toast.error("Couldn't dismiss. Try again."); return false; }
    return true;
  }, [recommendations, sample]);

  const updateItems = useCallback<OpsState["updateItems"]>(async (ids, patch) => {
    const set = new Set(ids);
    const before = items;
    setItems((all) => all.map((i) => (set.has(i.id) ? { ...i, ...patch } : i)));
    if (!itemsLive) return true;
    const results = await Promise.all(ids.map((id) => post(`/api/actions/${encodeURIComponent(id)}`, patchable(patch), "PATCH")));
    if (results.some((r) => !r.ok)) {
      setItems(before);
      const body = await results.find((r) => !r.ok)!.json().catch(() => ({}));
      toast.error((body as { error?: string }).error ?? "Couldn't update. Try again.");
      return false;
    }
    return true;
  }, [items, itemsLive]);

  const createItems = useCallback<OpsState["createItems"]>(async (newItems) => {
    const created: ActionItem[] = newItems.map((i) => ({ ...i, id: tmpId(), status: "open" }));
    const before = items;
    setItems((all) => [...created, ...all]);
    if (!itemsLive) return true;
    const results = await Promise.all(newItems.map((i) => post("/api/actions", i)));
    if (results.some((r) => !r.ok)) { setItems(before); toast.error("Couldn't create the action items."); return false; }
    reload();
    return true;
  }, [items, itemsLive, reload]);

  const value = useMemo(
    () => ({ ready, sample, metricsSample: true, insights, recommendations, items, metrics, accept, dismiss, updateItems, createItems, reload }),
    [ready, sample, insights, recommendations, items, metrics, accept, dismiss, updateItems, createItems, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOps() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOps must be used inside OpsProvider");
  return v;
}
