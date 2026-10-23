"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowUpRight, Banknote, Check, FileQuestion, Lightbulb, MessageSquare, PackageX, X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SAMPLE_INSIGHTS, SAMPLE_RECOMMENDATIONS } from "@/lib/sample";
import type { Insight, Recommendation } from "@/lib/types";

const AREA: Record<string, { label: string; icon: typeof Lightbulb }> = {
  shortage_recovery: { label: "Shortage recovery", icon: PackageX },
  unexplained_deductions: { label: "Unexplained deductions", icon: FileQuestion },
  cash_collection: { label: "Cash collection", icon: Banknote },
};
const SEVERITY: Record<Insight["severity"], string> = {
  high: "bg-danger-soft text-destructive border-destructive/30",
  medium: "bg-warning-soft text-warning border-warning/30",
  low: "bg-muted text-muted-foreground",
};

const usd = (v: number) => `$${Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
const metricValue = (i: Insight, v: number | null) =>
  v == null ? "–" : /\$/.test(i.metric) ? usd(v) : /rate|%/i.test(i.metric) ? `${v}%` : Intl.NumberFormat("en-US").format(v);
const pretty = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default function InsightsPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [sample, setSample] = useState(false);
  const [area, setArea] = useState("all");
  const [dismissing, setDismissing] = useState<Recommendation | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/insights"), fetch("/api/recommendations")])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw new Error();
        setInsights(await a.json());
        setRecs(await b.json());
      })
      .catch(() => {
        setSample(true);
        setInsights(SAMPLE_INSIGHTS);
        setRecs(SAMPLE_RECOMMENDATIONS);
      });
  }, []);

  const open = useMemo(
    () => (recs ?? []).filter((r) => r.status === "new").sort((a, b) => b.estimated_value_usd - a.estimated_value_usd),
    [recs],
  );
  const totalValue = open.reduce((s, r) => s + r.estimated_value_usd, 0);
  const shown = (insights ?? []).filter((i) => area === "all" || i.problem_area === area);
  const insightTitle = (id: string | null) => insights?.find((i) => i.id === id)?.title;

  async function respond(rec: Recommendation, action: "accept" | "dismiss", reason?: string) {
    setRecs((all) => all?.map((r) => (r.id === rec.id ? { ...r, status: action === "accept" ? "accepted" : "dismissed" } : r)) ?? null);
    if (sample) {
      toast.success(action === "accept" ? "Accepted (sample mode). In production this creates an action item." : "Dismissed (sample mode)");
      return;
    }
    const r = await fetch(`/api/recommendations/${encodeURIComponent(rec.id)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }),
    });
    if (!r.ok) {
      setRecs((all) => all?.map((x) => (x.id === rec.id ? rec : x)) ?? null);
      toast.error("Couldn't update the recommendation. Try again.");
      return;
    }
    if (action === "accept") {
      toast.success("Action item created", { action: { label: "View board", onClick: () => router.push("/actions") } });
    } else {
      toast("Recommendation dismissed", { description: "Your reason helps tune future recommendations." });
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Lightbulb className="size-5" /> Insights</h1>
              {sample && <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">Sample data</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">What changed, why it matters, and what to do next.</p>
          </div>
          <Link href="/?q=Explain%20the%20biggest%20recovery%20opportunity%20right%20now" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MessageSquare /> Ask the assistant
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_380px]">
        {/* Insights feed */}
        <section aria-labelledby="feed" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="feed" className="text-sm font-medium text-muted-foreground">Latest insights</h2>
            <Tabs value={area} onValueChange={(v) => setArea(String(v))}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                {Object.entries(AREA).map(([k, v]) => <TabsTrigger key={k} value={k}>{v.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </div>

          {insights === null && [0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}
          {insights && shown.length === 0 && (
            <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">No insights in this area yet.</CardContent></Card>
          )}

          {shown.map((i) => {
            const A = AREA[i.problem_area] ?? { label: pretty(i.problem_area), icon: Lightbulb };
            return (
              <Card key={i.id}>
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <A.icon className="size-3.5" /> {A.label}
                    <span aria-hidden>·</span>
                    <time dateTime={i.generated_at}>{new Date(i.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>
                  </div>
                  <CardTitle className="text-base">{i.title}</CardTitle>
                  <CardDescription>{i.summary}</CardDescription>
                  <CardAction>
                    <Badge variant="outline" className={SEVERITY[i.severity]}>
                      {i.severity === "high" && <AlertTriangle />} {i.severity}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
                  <div>
                    <div className="text-xs text-muted-foreground">{i.metric}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums tracking-tight">{metricValue(i, i.current_value)}</span>
                      {i.comparison_value != null && <span className="text-sm text-muted-foreground">vs {metricValue(i, i.comparison_value)}</span>}
                      {i.change_pct != null && (
                        <span className={`text-xs font-medium ${i.change_pct >= 0 ? "text-success" : "text-destructive"}`}>
                          {i.change_pct >= 0 ? "+" : ""}{i.change_pct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.related_entity && <span className="text-xs text-muted-foreground">{i.related_entity}</span>}
                    <Link href={`/?q=${encodeURIComponent(`Tell me more about: ${i.title}`)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Explore <ArrowUpRight />
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </section>

        {/* Recommended actions */}
        <aside aria-labelledby="recs" className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card size="sm" className="bg-primary text-primary-foreground">
            <CardContent>
              <div id="recs" className="text-sm opacity-80">Recommended actions</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{recs ? usd(totalValue) : "–"}</div>
              <div className="text-sm opacity-80">estimated value across {open.length} open recommendation{open.length === 1 ? "" : "s"}</div>
            </CardContent>
          </Card>

          {recs === null && [0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
          {recs && open.length === 0 && (
            <Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</CardContent></Card>
          )}

          {open.map((r) => (
            <Card key={r.id} size="sm">
              <CardHeader>
                <CardTitle>{pretty(r.action_type)}</CardTitle>
                {r.entity_id && <CardDescription>{r.entity_id}</CardDescription>}
                <CardAction className="text-right">
                  <div className="text-base font-semibold tabular-nums text-success">{usd(r.estimated_value_usd)}</div>
                  <div className="text-[11px] text-muted-foreground">est. value</div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{r.rationale}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Confidence</span><span className="tabular-nums">{Math.round(r.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.confidence * 100)} aria-label="Confidence">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${r.confidence * 100}%` }} />
                  </div>
                </div>
                {(insightTitle(r.insight_id) || r.expires_at) && (
                  <div className="text-xs text-muted-foreground">
                    {insightTitle(r.insight_id) && <>From: {insightTitle(r.insight_id)}</>}
                    {r.expires_at && <> · expires {r.expires_at}</>}
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-2 border-t pt-3">
                <Button size="sm" className="flex-1" onClick={() => respond(r, "accept")}><Check /> Accept</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setDismissing(r)}><X /> Dismiss</Button>
              </CardFooter>
            </Card>
          ))}
        </aside>
      </div>

      <ConfirmDialog
        open={dismissing !== null}
        onOpenChange={(o) => !o && setDismissing(null)}
        title="Dismiss this recommendation?"
        description="Tell us why. Reasons are kept and used to improve future recommendations."
        withReason="e.g. Already handled by the 3PL, outside dispute window…"
        confirmLabel="Dismiss"
        onConfirm={(reason) => { if (dismissing) respond(dismissing, "dismiss", reason); setDismissing(null); }}
      />
    </div>
  );
}
