"use client";
import { useCallback, useEffect, useState } from "react";
import { Bot, Box, Database, Loader2, Mail, MessageSquare, Plug, RefreshCw, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Status = {
  snowflake: { ok: boolean; ms: number; error?: string; value?: { ROLE: string; WH: string }[] };
  mcp: { ok: boolean; ms?: number; error?: string; tools?: { name: string; description?: string }[] };
  anthropic: { ok: boolean; model: string };
  sandbox: { ok: boolean; note: string };
};

function StatusBadge({ state }: { state: "connected" | "error" | "soon" | "loading" }) {
  if (state === "loading") return <Badge variant="outline"><Loader2 className="animate-spin" /> Checking</Badge>;
  if (state === "connected") return <Badge variant="outline" className="border-success/30 bg-success-soft text-success"><span className="size-1.5 rounded-full bg-success" /> Connected</Badge>;
  if (state === "soon") return <Badge variant="outline" className="text-muted-foreground">Coming soon</Badge>;
  return <Badge variant="outline" className="border-destructive/30 bg-danger-soft text-destructive"><span className="size-1.5 rounded-full bg-destructive" /> Not connected</Badge>;
}

function Integration({ icon: Icon, tone, title, description, state, detail }: {
  icon: typeof Plug; tone: string; title: string; description: string;
  state: "connected" | "error" | "soon" | "loading"; detail?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" /></div>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <CardAction><StatusBadge state={state} /></CardAction>
      </CardHeader>
      {detail && <CardFooter className="break-words text-xs text-muted-foreground">{detail}</CardFooter>}
    </Card>
  );
}

export default function IntegrationsPage() {
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    fetch("/api/integrations")
      .then(async (r) => setS(await r.json()))
      .catch(() => setS(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const st = (ok?: boolean) => (loading || !s ? "loading" : ok ? "connected" : "error") as "connected" | "error" | "loading";

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 sm:px-8 py-5">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Plug className="size-5" /> Integrations</h1>
            <p className="text-sm text-muted-foreground">Systems the assistant connects to</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); fetchStatus(); }} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-check
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-8 py-6">
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Data & AI</h2>
          <Integration icon={Snowflake} tone="bg-info-soft text-info" title="Snowflake Cortex Agent"
            description="Governed sales metrics and call transcripts via managed MCP"
            state={st(s?.mcp.ok)}
            detail={s ? (s.mcp.ok ? `Tools: ${s.mcp.tools?.map((t) => t.name).join(", ") || "none"} · ${s.mcp.ms} ms` : s.mcp.error) : undefined} />
          <Integration icon={Database} tone="bg-muted text-foreground" title="Snowflake workspace"
            description="Stores conversations, dashboards and action items"
            state={st(s?.snowflake.ok)}
            detail={s ? (s.snowflake.ok ? `Role ${s.snowflake.value?.[0]?.ROLE} · warehouse ${s.snowflake.value?.[0]?.WH}` : s.snowflake.error) : undefined} />
          <Integration icon={Bot} tone="bg-muted text-foreground" title={`Anthropic · ${s?.anthropic.model ?? "Claude"}`}
            description="Reasoning, charts and dashboard generation"
            state={st(s?.anthropic.ok)} detail={s && !s.anthropic.ok ? "API key not configured" : undefined} />
          <Integration icon={Box} tone="bg-muted text-foreground" title="Vercel Sandbox"
            description="Isolated runtime for each conversation"
            state={st(s?.sandbox.ok)} detail={s && !s.sandbox.ok ? s.sandbox.note : undefined} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Notifications</h2>
          <Integration icon={MessageSquare} tone="bg-muted text-foreground" title="Slack" description="Send action items and dashboard digests to a channel" state="soon" />
          <Integration icon={Mail} tone="bg-muted text-foreground" title="Email" description="Weekly summary of open action items" state="soon" />
        </section>
      </div>
    </div>
  );
}
