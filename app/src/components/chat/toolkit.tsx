"use client";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Toolkit, ToolCallMessagePartComponent } from "@assistant-ui/react";
import { AlertCircle, ArrowUpRight, CheckCircle2, CheckSquare, Database, LayoutDashboard, Loader2, Pin } from "lucide-react";
import { DecisionBar } from "@/components/DecisionBar";
import { ChartCard } from "@/components/ChartCard";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionItem, AgentEvent, ChartSpec } from "@/lib/types";
import { UI_TOOLS } from "./use-sales-runtime";

const SnowflakeQuery: ToolCallMessagePartComponent = ({ args, result }) => {
  const q = String((args as Record<string, unknown>)?.message ?? (args as Record<string, unknown>)?.query ?? (args as Record<string, unknown>)?.question ?? "");
  return (
    <div className="my-1.5 flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
        <Database className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          Snowflake Cortex Agent
          {result ? <CheckCircle2 className="size-3.5 text-success" /> : <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        {q && <div className="truncate text-muted-foreground">{q}</div>}
      </div>
    </div>
  );
};

const Quiet: ToolCallMessagePartComponent = () => null;

function PinnableChart({ spec }: { spec: ChartSpec }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "pinned">("idle");
  async function pin() {
    setState("saving");
    const r = await fetch("/api/dashboards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec }) });
    setState(r.ok ? "pinned" : "idle");
    if (r.ok) toast.success("Pinned to dashboard", { action: { label: "Open", onClick: () => router.push("/dashboard") } });
    else toast.error("Couldn't pin this chart");
  }
  return (
    <div className="my-3 space-y-2">
    <ChartCard
      spec={spec}
      action={
        <Button size="sm" variant="outline" onClick={pin} disabled={state !== "idle"}>
          {state === "saving" ? <Loader2 className="animate-spin" /> : state === "pinned" ? <CheckCircle2 /> : <Pin />}
          {state === "pinned" ? "Pinned" : "Pin"}
        </Button>
      }
    />
    <DecisionBar
      title={spec.title ?? "Follow up on this chart"}
      detail={spec.description}
      followUp={`About "${spec.title ?? "this chart"}": what is driving it, and what should we do next?`}
    />
    </div>
  );
}

const ChartUI: ToolCallMessagePartComponent = ({ result }) => (result ? <PinnableChart spec={result as ChartSpec} /> : null);

const DashboardUI: ToolCallMessagePartComponent = ({ result }) => {
  const d = result as Extract<AgentEvent, { type: "dashboard" }> | undefined;
  if (!d) return null;
  return (
    <Card size="sm" className="my-3 bg-gradient-to-br from-info-soft to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LayoutDashboard className="size-4 text-info" /> {d.name}</CardTitle>
        <CardDescription>Dashboard ready · {d.widgets} widgets</CardDescription>
        <CardAction>
          <Link href={`/dashboard?d=${encodeURIComponent(d.id)}`} className={buttonVariants({ size: "sm" })}>
            Open <ArrowUpRight />
          </Link>
        </CardAction>
      </CardHeader>
    </Card>
  );
};

const PRIORITY: Record<string, string> = {
  high: "bg-danger-soft text-destructive border-destructive/30",
  medium: "bg-warning-soft text-warning border-warning/30",
  low: "bg-muted text-muted-foreground",
};

const ActionsUI: ToolCallMessagePartComponent = ({ result }) => {
  const items = (result as ActionItem[] | undefined) ?? [];
  if (!items.length) return null;
  return (
    <Card size="sm" className="my-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CheckSquare className="size-4 text-success" /> {items.length} action item{items.length > 1 ? "s" : ""} added</CardTitle>
        <CardAction>
          <Link href="/actions" className={buttonVariants({ size: "sm", variant: "ghost" })}>View board <ArrowUpRight /></Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
              <div className="mt-1 size-3.5 shrink-0 rounded border" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{a.title}</div>
                {(a.owner || a.due_date) && (
                  <div className="text-xs text-muted-foreground">{[a.owner, a.due_date && `due ${a.due_date}`].filter(Boolean).join(" · ")}</div>
                )}
              </div>
              <Badge variant="outline" className={PRIORITY[a.priority ?? "medium"]}>{a.priority ?? "medium"}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const ErrorUI: ToolCallMessagePartComponent = ({ result }) => (
  <div className="my-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
    <AlertCircle className="mt-0.5 size-4 shrink-0" />
    <span>{String(result ?? "Something went wrong")}</span>
  </div>
);

/** UI-only renderers: these tools run on the backend; we only draw their results. */
export const chatToolkit: Toolkit = {
  mcp__snowflake__sales_intelligence_agent: { type: "backend", render: SnowflakeQuery },
  Skill: { type: "backend", render: Quiet },
  Read: { type: "backend", render: Quiet },
  [UI_TOOLS.chart]: { type: "backend", render: ChartUI },
  [UI_TOOLS.dashboard]: { type: "backend", render: DashboardUI },
  [UI_TOOLS.actions]: { type: "backend", render: ActionsUI },
  [UI_TOOLS.error]: { type: "backend", render: ErrorUI },
};
