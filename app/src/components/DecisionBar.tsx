"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListPlus, MessageSquare, Pin, Share2 } from "lucide-react";
import { AcceptDialog } from "@/components/DecisionDialogs";
import { Button } from "@/components/ui/button";
import { useOps } from "@/lib/ops-store";

/**
 * Turns any answer or insight into a decision in one click: create an action item, ask a
 * follow-up, share, or pin. Keeps the context (title + detail) so nobody has to retype it.
 */
export function DecisionBar({
  title, detail, followUp, onPin, actionType = "other", className = "",
}: {
  title: string;
  detail?: string;
  followUp?: string;
  onPin?: () => void;
  actionType?: string;
  className?: string;
}) {
  const router = useRouter();
  const { createItems, sample } = useOps();
  const [open, setOpen] = useState(false);

  async function share() {
    const text = `${title}${detail ? `\n${detail}` : ""}\n${window.location.origin}${window.location.pathname}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard", { description: "Paste it into Slack or email." });
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}><ListPlus /> Create action item</Button>
      {onPin && <Button size="xs" variant="ghost" onClick={onPin}><Pin /> Pin</Button>}
      {followUp && (
        <Button size="xs" variant="ghost" onClick={() => router.push(`/assistant?q=${encodeURIComponent(followUp)}`)}>
          <MessageSquare /> Ask follow-up
        </Button>
      )}
      <Button size="xs" variant="ghost" onClick={share}><Share2 /> Share</Button>

      <AcceptDialog
        open={open}
        onOpenChange={setOpen}
        count={1}
        title="Create action item"
        confirmLabel="Create"
        onConfirm={async (input) => {
          setOpen(false);
          const ok = await createItems([{
            title, detail: input.note || detail, owner: input.owner, due_date: input.due_date ?? null,
            priority: "medium", action_type: actionType, source: "user",
          }]);
          if (ok) toast.success(`Action item assigned to ${input.owner}`, {
            description: sample ? "Sample mode: saved for this session only." : undefined,
            action: { label: "View board", onClick: () => router.push("/actions") },
          });
        }}
      />
    </div>
  );
}
