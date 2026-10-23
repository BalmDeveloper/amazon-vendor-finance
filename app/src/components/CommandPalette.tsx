"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CheckSquare, House, LayoutDashboard, Lightbulb, ListChecks, MessageSquare, Moon, Plug, Sparkles, Workflow,
} from "lucide-react";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { humanize, isOpenRec, usd } from "@/lib/format";
import { useOps } from "@/lib/ops-store";
import { SAMPLE_PLAYBOOKS } from "@/lib/sample";

const EVENT = "open-command-palette";
export const openCommandPalette = () => window.dispatchEvent(new Event(EVENT));

const PAGES = [
  { href: "/", label: "Today", icon: House },
  { href: "/assistant", label: "Assistant", icon: MessageSquare },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/dashboard", label: "Dashboards", icon: LayoutDashboard },
  { href: "/actions", label: "Action items", icon: CheckSquare },
  { href: "/playbooks", label: "Playbooks", icon: ListChecks },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

/** ⌘K: jump anywhere, ask the assistant, or find an insight, recommendation or action item. */
export function CommandPalette() {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { insights, recommendations, items } = useOps();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT, onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(EVENT, onOpen); };
  }, []);

  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };

  return (
    <CommandDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }} title="Search" description="Jump to a page, ask the assistant, or find an item">
      <Command>
        <CommandInput placeholder="Search or ask a question…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          {q.trim() && (
            <CommandGroup heading="Assistant" forceMount>
              <CommandItem value={`ask ${q}`} forceMount onSelect={() => go(`/assistant?q=${encodeURIComponent(q.trim())}`)}>
                <Sparkles /> Ask: <span className="truncate font-medium">{q.trim()}</span>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Go to">
            {PAGES.map((p) => (
              <CommandItem key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)}><p.icon /> {p.label}</CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Playbooks">
            {SAMPLE_PLAYBOOKS.map((p) => (
              <CommandItem key={p.id} value={`playbook ${p.title} ${p.summary}`} onSelect={() => go(`/playbooks/${p.id}`)}>
                <ListChecks /> Run {p.title.toLowerCase()} <CommandShortcut>{usd(p.estimated_value_usd)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          {recommendations.some(isOpenRec) && (
            <CommandGroup heading="Recommendations">
              {recommendations.filter(isOpenRec).map((r) => (
                <CommandItem key={r.id} value={`rec ${r.title} ${r.action_type} ${r.rationale ?? ""}`} onSelect={() => go("/insights")}>
                  <Lightbulb /> <span className="truncate">{r.title}</span>
                  <CommandShortcut>{usd(r.estimated_value_usd)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {insights.length > 0 && (
            <CommandGroup heading="Insights">
              {insights.map((i) => (
                <CommandItem key={i.id} value={`insight ${i.title} ${i.summary ?? ""}`} onSelect={() => go("/insights")}><Lightbulb /> {i.title}</CommandItem>
              ))}
            </CommandGroup>
          )}
          {items.length > 0 && (
            <CommandGroup heading="Action items">
              {items.filter((i) => i.status !== "dismissed").map((i) => (
                <CommandItem key={i.id} value={`item ${i.title} ${i.owner ?? ""}`} onSelect={() => go("/actions")}>
                  <CheckSquare /> <span className="truncate">{i.title}</span>
                  <CommandShortcut>{humanize(i.status)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Preferences">
            <CommandItem value="toggle theme dark light" onSelect={() => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setOpen(false); }}>
              <Moon /> Toggle dark mode
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
