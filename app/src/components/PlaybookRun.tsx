"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { humanize, usd } from "@/lib/format";
import { useOps } from "@/lib/ops-store";
import { OWNERS, SAMPLE_PLAYBOOKS } from "@/lib/sample";

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/** Guided pick → assign → create flow for one playbook. */
export function PlaybookRun({ id }: { id: string }) {
  const router = useRouter();
  const { createItems, sample } = useOps();
  const pb = SAMPLE_PLAYBOOKS.find((p) => p.id === id);

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(pb?.rows.map((r) => r.id)));
  const [owner, setOwner] = useState("Me");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  if (!pb) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Playbook not found.</p>
        <Link href="/playbooks" className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}>All playbooks</Link>
      </div>
    );
  }

  const rows = pb.rows.filter((r) => picked.has(r.id));
  const total = rows.reduce((s, r) => s + r.value_usd, 0);
  const current = pb.steps[step];
  const last = step === pb.steps.length - 1;
  const toggle = (rid: string) => setPicked((s) => { const n = new Set(s); if (n.has(rid)) n.delete(rid); else n.add(rid); return n; });

  async function finish() {
    if (!pb) return;
    setBusy(true);
    const ok = await createItems(rows.map((r) => ({
      title: `${humanize(pb.action_type)}: ${r.label}`, notes: `${pb.title} playbook · ${r.detail} · ${usd(r.value_usd, false)}`,
      owner, due_date: due || null, amount_usd: r.value_usd, priority: r.value_usd >= 30_000 ? "high" : "medium", action_type: pb.action_type, source: "playbook",
    })));
    setBusy(false);
    if (ok) {
      toast.success(`${rows.length} action items assigned to ${owner}`, {
        description: sample ? "Sample mode: saved for this session only." : `${usd(total)} now tracked to recovery.`,
      });
      router.push("/actions");
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <div>
            <Link href="/playbooks" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> Playbooks</Link>
            <h1 className="text-lg font-semibold tracking-tight">{pb.title}</h1>
            <p className="text-sm text-muted-foreground">{pb.summary}</p>
          </div>
          <Link href={`/assistant?q=${encodeURIComponent(`Help me run the ${pb.title} playbook. Which items should I prioritize and why?`)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}><MessageSquare /> Ask the assistant</Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-8">
        {/* Stepper */}
        <ol className="flex items-center gap-2" aria-label="Progress">
          {pb.steps.map((s, i) => (
            <li key={s.id} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums ${
                i < step ? "bg-success text-white" : i === step ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={`truncate text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s.title}</span>
              {i < pb.steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>

        <Card>
          <CardHeader>
            <CardTitle>{current.title}</CardTitle>
            <CardDescription>{current.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {current.kind === "review" && (
              <ul className="divide-y rounded-lg border">
                {pb.rows.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                      <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                      <span className="flex-1">
                        <span className="font-medium">{r.label}</span>
                        <span className="block text-xs text-muted-foreground">{r.detail}</span>
                      </span>
                      <span className="tabular-nums text-success">{usd(r.value_usd)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {current.kind === "assign" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="pb-owner">Owner</Label>
                  <Select value={owner} onValueChange={(v) => setOwner(String(v))}>
                    <SelectTrigger id="pb-owner" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pb-due">Due date</Label>
                  <Input id="pb-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
              </div>
            )}
            {current.kind === "confirm" && (
              <div className="space-y-3 text-sm">
                <p>
                  Create <span className="font-medium">{rows.length} action item{rows.length === 1 ? "" : "s"}</span> worth{" "}
                  <span className="font-medium text-success">{usd(total)}</span>, assigned to <span className="font-medium">{owner}</span>, due{" "}
                  <span className="font-medium">{due || "no date"}</span>.
                </p>
                <div className="flex flex-wrap gap-1.5">{rows.map((r) => <Badge key={r.id} variant="secondary">{r.label}</Badge>)}</div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground"><span className="tabular-nums">{rows.length}</span> selected · <span className="tabular-nums text-success">{usd(total)}</span></div>
            <div className="flex gap-2">
              {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft /> Back</Button>}
              {last ? (
                <Button onClick={finish} disabled={busy || rows.length === 0}><Check /> Create {rows.length} item{rows.length === 1 ? "" : "s"}</Button>
              ) : (
                <Button onClick={() => { if (!due) setDue(inDays(7)); setStep(step + 1); }} disabled={rows.length === 0}>Next <ArrowRight /></Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
