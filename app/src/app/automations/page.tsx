"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, MessageSquare, Newspaper, Play, RefreshCw, Smartphone, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usd } from "@/lib/format";
import { SAMPLE_AUTOMATIONS } from "@/lib/sample";
import type { Automation } from "@/lib/types";

const KIND = { digest: Newspaper, alert: Bell, refresh: RefreshCw };
const CHANNEL = { slack: { label: "Slack", icon: MessageSquare }, email: { label: "Email", icon: Mail }, app: { label: "In app", icon: Smartphone } };
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export default function AutomationsPage() {
  const [list, setList] = useState<Automation[] | null>(null);
  const [sample, setSample] = useState(false);

  useEffect(() => {
    fetch("/api/automations")
      .then(async (r) => { if (!r.ok) throw new Error(); setList(await r.json()); })
      .catch(() => { setSample(true); setList(SAMPLE_AUTOMATIONS); });
  }, []);

  async function save(a: Automation, patch: Partial<Automation>, msg: string) {
    const before = list;
    setList((l) => l?.map((x) => (x.id === a.id ? { ...x, ...patch } : x)) ?? null);
    if (sample) { toast.success(msg, { description: "Sample mode: not scheduled yet." }); return; }
    const r = await fetch(`/api/automations/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!r.ok) { setList(before); toast.error("Couldn't save the automation"); } else toast.success(msg);
  }

  async function runNow(a: Automation) {
    if (sample) {
      setList((l) => l?.map((x) => (x.id === a.id ? { ...x, last_run_at: new Date().toISOString() } : x)) ?? null);
      toast.success(`${a.title} ran`, { description: "Sample mode: nothing was sent." });
      return;
    }
    const r = await fetch(`/api/automations/${a.id}/run`, { method: "POST" });
    if (r.ok) toast.success(`${a.title} started`); else toast.error("Couldn't run the automation");
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-8">
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Workflow className="size-5" /> Automations</h1>
            {sample && <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">Sample data</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Put recurring work on a schedule so nobody has to remember it. Runs as Snowflake tasks and alerts.</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-8 md:grid-cols-2 xl:grid-cols-3">
        {list === null && [0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />)}
        {list?.map((a) => {
          const Icon = KIND[a.kind];
          const Ch = CHANNEL[a.channel];
          return (
            <Card key={a.id} className={a.enabled ? "" : "opacity-80"}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span>
                  <CardTitle>{a.title}</CardTitle>
                </div>
                <CardDescription>{a.description}</CardDescription>
                <CardAction>
                  <Switch checked={a.enabled} aria-label={a.enabled ? `Turn off ${a.title}` : `Turn on ${a.title}`}
                    onCheckedChange={(on) => save(a, { enabled: on }, on ? `${a.title} turned on` : `${a.title} paused`)} />
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`cad-${a.id}`}>Runs</Label>
                  <Select value={a.cadence} onValueChange={(v) => save(a, { cadence: String(v) as Automation["cadence"] }, "Schedule updated")}>
                    <SelectTrigger id={`cad-${a.id}`} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {a.threshold_usd != null ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor={`thr-${a.id}`}>Alert above</Label>
                    <Input id={`thr-${a.id}`} inputMode="numeric" defaultValue={a.threshold_usd}
                      onBlur={(e) => {
                        const n = Number(e.target.value.replace(/[$,\s]/g, ""));
                        if (Number.isFinite(n) && n > 0 && n !== a.threshold_usd) save(a, { threshold_usd: n }, `Threshold set to ${usd(n, false)}`);
                      }} />
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label>Sends to</Label>
                    <div className="flex h-8 items-center gap-1.5 text-sm text-muted-foreground"><Ch.icon className="size-4" /> {Ch.label}</div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                <div>
                  <div>Last run: <span className="tabular-nums">{when(a.last_run_at)}</span></div>
                  <div>Next run: <span className="tabular-nums">{a.enabled ? when(a.next_run_at) : "paused"}</span></div>
                </div>
                <Button size="sm" variant="outline" onClick={() => runNow(a)}><Play /> Run now</Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
