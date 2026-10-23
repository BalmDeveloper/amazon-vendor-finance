"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ChartCard } from "@/components/ChartCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SAMPLE_DASHBOARD, SAMPLE_WIDGETS } from "@/lib/sample";
import type { Dashboard, Widget } from "@/lib/types";

const SPAN = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3" } as const;

function defaultSpan(w: Widget) {
  return w.spec.span ?? (w.spec.type === "kpi" || w.spec.type === "table" ? 3 : 1);
}

export default function DashboardPage() {
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null);
  const [active, setActive] = useState("");
  const [widgets, setWidgets] = useState<Widget[] | null>(null);
  const [sample, setSample] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("d");
    fetch("/api/dashboards")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const list: Dashboard[] = await r.json();
        setDashboards(list);
        setActive(list.find((d) => d.id === wanted)?.id ?? list[0]?.id ?? "");
      })
      .catch(() => {
        setSample(true);
        setDashboards([SAMPLE_DASHBOARD]);
        setActive(SAMPLE_DASHBOARD.id);
        setWidgets(SAMPLE_WIDGETS);
      });
  }, []);

  useEffect(() => {
    if (!active || active === SAMPLE_DASHBOARD.id) return;
    let live = true;
    fetch(`/api/dashboards?id=${encodeURIComponent(active)}`)
      .then(async (r) => live && setWidgets(r.ok ? await r.json() : []));
    return () => { live = false; };
  }, [active]);

  function select(id: string) {
    setWidgets(null);
    setActive(id);
    window.history.replaceState(null, "", `?d=${encodeURIComponent(id)}`);
  }

  async function removeWidget(id: string) {
    const before = widgets;
    setWidgets((w) => w?.filter((x) => x.id !== id) ?? null);
    if (sample) return;
    const r = await fetch(`/api/dashboards?widget=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) toast("Widget removed");
    else { setWidgets(before); toast.error("Couldn't remove the widget"); }
  }

  async function removeDashboard(id: string) {
    const r = await fetch(`/api/dashboards/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) { toast.error("Couldn't delete the dashboard"); return; }
    toast.success("Dashboard deleted");
    const rest = dashboards?.filter((d) => d.id !== id) ?? [];
    setDashboards(rest);
    select(rest[0]?.id ?? "");
  }

  const current = dashboards?.find((d) => d.id === active);
  const kpis = widgets?.filter((w) => w.spec.type === "kpi") ?? [];
  const rest = widgets?.filter((w) => w.spec.type !== "kpi") ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight truncate">{current?.name ?? "Dashboards"}</h1>
              {sample && <Badge variant="outline" className="text-warning border-warning/30 bg-warning-soft">Sample data</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">Live insights from Snowflake · built by Claude</p>
          </div>
          <div className="flex items-center gap-2">
            {current && !sample && current.id !== "default" && (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            <Link href="/?q=Build%20a%20sales%20pipeline%20dashboard" className={buttonVariants({ size: "sm" })}>
              <Sparkles /> New dashboard
            </Link>
          </div>
        </div>
        {dashboards && dashboards.length > 1 && (
          <div className="mx-auto max-w-7xl px-4 sm:px-8 pb-3">
            <Tabs value={active} onValueChange={(v) => select(String(v))}>
              <TabsList>
                {dashboards.map((d) => (
                  <TabsTrigger key={d.id} value={d.id} className="gap-1.5">
                    {d.name}
                    <span className="text-[10px] text-muted-foreground tabular-nums">{d.widget_count}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-6 space-y-4">
        {sample && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning">
            Showing sample data. Connect Snowflake on the Integrations page to load your dashboards.
          </div>
        )}

        {widgets === null && <DashboardSkeleton />}

        {widgets?.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <LayoutDashboard className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">This dashboard is empty</p>
              <p className="text-sm text-muted-foreground">Ask Claude to build one, or pin charts from a conversation.</p>
              <Link href="/?q=Build%20a%20sales%20pipeline%20dashboard" className={`${buttonVariants({ size: "sm" })} mt-4`}>
                <Sparkles /> Build with Claude
              </Link>
            </CardContent>
          </Card>
        )}

        {kpis.map((w) => <KpiStrip key={w.id} widget={w} onRemove={sample ? undefined : () => removeWidget(w.id)} />)}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {rest.map((w) => (
            <ChartCard
              key={w.id}
              spec={w.spec}
              className={SPAN[defaultSpan(w)]}
              action={!sample && (
                <Button size="icon" variant="ghost" className="size-7 text-muted-foreground" onClick={() => removeWidget(w.id)} aria-label="Remove widget">
                  <X />
                </Button>
              )}
            />
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${current?.name ?? "dashboard"}"?`}
        description="This removes the dashboard and all of its widgets. This can't be undone."
        confirmLabel="Delete dashboard"
        destructive
        onConfirm={() => { setConfirmDelete(false); if (current) removeDashboard(current.id); }}
      />
    </div>
  );
}

/** KPIs render as a row of stat cards rather than one card with tiles. */
function KpiStrip({ widget, onRemove }: { widget: Widget; onRemove?: () => void }) {
  const { data, unit } = widget.spec;
  const fmt = (v: unknown) =>
    typeof v === "number"
      ? `${unit === "USD" ? "$" : ""}${Intl.NumberFormat("en-US", { notation: Math.abs(v) >= 1e5 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v)}${unit === "%" ? "%" : ""}`
      : String(v ?? "");
  return (
    <div className="group relative grid grid-cols-2 lg:grid-cols-4 gap-4">
      {data.map((d, i) => {
        const delta = d.delta == null ? null : Number(d.delta);
        return (
          <Card key={i} size="sm">
            <CardContent>
              <div className="text-sm text-muted-foreground">{String(d.label ?? "")}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{fmt(d.value)}</div>
              {delta != null && (
                <div className="mt-1 flex items-center gap-1 text-xs">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${delta >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"}`}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">vs prior period</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {onRemove && (
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Remove KPIs"
          className="absolute -top-2 -right-2 size-6 rounded-full bg-background border opacity-0 group-hover:opacity-100">
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-72 rounded-xl bg-muted lg:col-span-2" />
        <div className="h-72 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
