"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usd } from "@/lib/format";
import { OWNERS } from "@/lib/sample";
import type { AcceptInput } from "@/lib/ops-store";

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/** Accept one or more recommendations: hand off to an owner with a due date in a single step. */
export function AcceptDialog({
  open, onOpenChange, count, value, title, onConfirm, confirmLabel = "Accept & assign",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  value?: number;
  title?: string;
  confirmLabel?: string;
  onConfirm: (input: AcceptInput) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form each time it opens so fields reset. */}
        {open && <AcceptForm count={count} value={value} title={title} confirmLabel={confirmLabel} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function AcceptForm({ count, value, title, confirmLabel, onCancel, onConfirm }: {
  count: number; value?: number; title?: string; confirmLabel: string; onCancel: () => void; onConfirm: (i: AcceptInput) => void;
}) {
  const [owner, setOwner] = useState("Me");
  const [due, setDue] = useState(inDays(7));
  const [note, setNote] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onConfirm({ owner, due_date: due || null, note: note.trim() || undefined }); }} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title ?? (count === 1 ? "Accept recommendation" : `Accept ${count} recommendations`)}</DialogTitle>
        <DialogDescription>
          Creates {count === 1 ? "an action item" : `${count} action items`}
          {value ? <> worth <span className="font-medium text-foreground">{usd(value)}</span> est.</> : null} and assigns the owner.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="owner">Owner</Label>
          <Select value={owner} onValueChange={(v) => setOwner(String(v))}>
            <SelectTrigger id="owner" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="due">Due date</Label>
          <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context for the owner…" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{confirmLabel}</Button>
      </DialogFooter>
    </form>
  );
}

/** Record what an action actually recovered when it is marked done. Closes the loop on value. */
export function OutcomeDialog({
  open, onOpenChange, count, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  onConfirm: (amount: number | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open && <OutcomeForm count={count} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function OutcomeForm({ count, onConfirm }: { count: number; onConfirm: (amount: number | null) => void }) {
  const [amount, setAmount] = useState("");
  const n = Number(amount.replace(/[$,\s]/g, ""));
  const valid = amount.trim() !== "" && Number.isFinite(n) && n >= 0;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onConfirm(valid ? n : null); }} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{count === 1 ? "Mark as done" : `Mark ${count} items as done`}</DialogTitle>
        <DialogDescription>How much was recovered or collected? This feeds &ldquo;Recovered to date&rdquo;.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="amount">Amount recovered{count > 1 ? " (total)" : ""}</Label>
        <Input id="amount" inputMode="decimal" autoFocus placeholder="$0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onConfirm(null)}>Skip</Button>
        <Button type="submit" disabled={!valid}>Save</Button>
      </DialogFooter>
    </form>
  );
}
