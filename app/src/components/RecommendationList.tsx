"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, MessageSquare, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AcceptDialog } from "@/components/DecisionDialogs";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { confidenceLevel, humanize, usd } from "@/lib/format";
import { useOps } from "@/lib/ops-store";
import type { Recommendation } from "@/lib/types";

const CONF_TONE: Record<"high" | "medium" | "low", string> = {
  high: "bg-success-soft text-success border-success/30",
  medium: "bg-info-soft text-info border-info/30",
  low: "bg-muted text-muted-foreground",
};

export const askWhy = (r: Recommendation, insightTitle?: string) =>
  `/assistant?q=${encodeURIComponent(
    `Why do you recommend "${r.title}"? Show the evidence${insightTitle ? ` behind "${insightTitle}"` : ""} and how the estimated ${usd(r.estimated_value_usd)} value is computed.`,
  )}`;

/** Recommendations with one-click accept (owner + due date), dismiss with reason, ask-why, and bulk actions. */
export function RecommendationList({ recs, compact = false }: { recs: Recommendation[]; compact?: boolean }) {
  const router = useRouter();
  const { insights, accept, dismiss, sample } = useOps();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accepting, setAccepting] = useState<Recommendation[] | null>(null);
  const [dismissing, setDismissing] = useState<Recommendation[] | null>(null);

  const insightTitle = (id?: string | null) => insights.find((i) => i.id === id)?.title;
  const picked = recs.filter((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sum = (list: Recommendation[]) => list.reduce((s, r) => s + (r.estimated_value_usd ?? 0), 0);

  return (
    <div className="space-y-3">
      {recs.length > 1 && (
        <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm">
          <Checkbox
            aria-label="Select all"
            checked={picked.length === recs.length}
            indeterminate={picked.length > 0 && picked.length < recs.length}
            onCheckedChange={(c) => setSelected(c ? new Set(recs.map((r) => r.id)) : new Set())}
          />
          {picked.length === 0 ? (
            <span className="text-muted-foreground">Select to act on several at once</span>
          ) : (
            <>
              <span className="font-medium">{picked.length} selected</span>
              <span className="text-muted-foreground">· {usd(sum(picked))}</span>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" onClick={() => setAccepting(picked)}><Check /> Accept</Button>
                <Button size="sm" variant="outline" onClick={() => setDismissing(picked)}><X /> Dismiss</Button>
              </div>
            </>
          )}
        </div>
      )}

      {recs.map((r) => {
        const from = insightTitle(r.insight_id);
        const level = confidenceLevel(r.confidence);
        return (
          <Card key={r.id} size="sm" className={selected.has(r.id) ? "ring-2 ring-primary/40" : undefined}>
            <CardHeader>
              <div className="flex items-start gap-2.5">
                {recs.length > 1 && <Checkbox className="mt-0.5" aria-label={`Select ${r.title}`} checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />}
                <div className="min-w-0 space-y-1">
                  <CardTitle>{r.title}</CardTitle>
                  <CardDescription>{humanize(r.action_type)}{r.entity_id ? ` · ${r.entity_id}` : ""}</CardDescription>
                </div>
              </div>
              <CardAction className="text-right">
                <div className="text-base font-semibold tabular-nums text-success">{usd(r.estimated_value_usd)}</div>
                <div className="text-[11px] text-muted-foreground">est. value</div>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {r.rationale && <p className={`text-sm text-muted-foreground ${compact ? "line-clamp-2" : ""}`}>{r.rationale}</p>}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {level && <Badge variant="outline" className={CONF_TONE[level]}>{level} confidence</Badge>}
                {r.expires_at && <span>· act by {new Date(r.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                {from && !compact && <span className="truncate">· from &ldquo;{from}&rdquo;</span>}
              </div>
            </CardContent>
            <CardFooter className="gap-2 border-t pt-3">
              <Button size="sm" className="flex-1" onClick={() => setAccepting([r])}><Check /> Accept</Button>
              <Button size="sm" variant="outline" onClick={() => setDismissing([r])} aria-label="Dismiss"><X /><span className="max-sm:hidden">Dismiss</span></Button>
              <Link href={askWhy(r, from)} className={buttonVariants({ size: "sm", variant: "ghost" })}><MessageSquare /> Ask why</Link>
            </CardFooter>
          </Card>
        );
      })}

      <AcceptDialog
        open={accepting !== null}
        onOpenChange={(o) => !o && setAccepting(null)}
        count={accepting?.length ?? 0}
        value={accepting ? sum(accepting) : undefined}
        onConfirm={async (input) => {
          const list = accepting ?? [];
          setAccepting(null);
          setSelected(new Set());
          if (await accept(list, input)) {
            toast.success(list.length === 1 ? `Assigned to ${input.owner}` : `${list.length} action items assigned to ${input.owner}`, {
              description: sample ? "Sample mode: saved for this session only." : undefined,
              action: { label: "View board", onClick: () => router.push("/actions") },
            });
          }
        }}
      />
      <ConfirmDialog
        open={dismissing !== null}
        onOpenChange={(o) => !o && setDismissing(null)}
        title={dismissing && dismissing.length > 1 ? `Dismiss ${dismissing.length} recommendations?` : "Dismiss this recommendation?"}
        description="Tell us why. Reasons are kept and used to improve future recommendations."
        withReason="e.g. Already handled by the 3PL, outside dispute window…"
        confirmLabel="Dismiss"
        onConfirm={async (reason) => {
          const list = dismissing ?? [];
          setDismissing(null);
          setSelected(new Set());
          if (await dismiss(list, reason)) toast("Dismissed", { description: "Your reason helps tune future recommendations." });
        }}
      />
    </div>
  );
}
