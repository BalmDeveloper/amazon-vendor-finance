"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CheckSquare, House, LayoutDashboard, Lightbulb, ListChecks, Menu, MessageSquare, Moon, Plug, Search, Snowflake, Sun, Workflow,
} from "lucide-react";
import { openCommandPalette } from "@/components/CommandPalette";
import { isOpenRec, isOverdue } from "@/lib/format";
import { useOps } from "@/lib/ops-store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Badge = "recs" | "overdue";
const GROUPS: { label: string; links: { href: string; label: string; icon: typeof House; badge?: Badge }[] }[] = [
  {
    label: "Decide",
    links: [
      { href: "/", label: "Today", icon: House },
      { href: "/assistant", label: "Assistant", icon: MessageSquare },
      { href: "/insights", label: "Insights", icon: Lightbulb, badge: "recs" },
      { href: "/dashboard", label: "Dashboards", icon: LayoutDashboard },
    ],
  },
  {
    label: "Act",
    links: [
      { href: "/actions", label: "Action items", icon: CheckSquare, badge: "overdue" },
      { href: "/playbooks", label: "Playbooks", icon: ListChecks },
      { href: "/automations", label: "Automations", icon: Workflow },
    ],
  },
  { label: "Settings", links: [{ href: "/integrations", label: "Integrations", icon: Plug }] },
];

const subscribe = () => () => {};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Theme is only known on the client; avoid a hydration mismatch on the icon.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Snowflake className="size-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Vendor Finance</div>
        <div className="text-xs text-muted-foreground">Claude × Snowflake</div>
      </div>
    </div>
  );
}

function Links({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { recommendations, items } = useOps();
  const counts: Record<Badge, number> = {
    recs: recommendations.filter(isOpenRec).length,
    overdue: items.filter((i) => (i.status === "open" || i.status === "in_progress") && isOverdue(i.due_date)).length,
  };
  return (
    <div className="space-y-4 px-2">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{g.label}</div>
          <ul className="space-y-0.5">
            {g.links.map(({ href, label, icon: Icon, badge }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              const n = badge ? counts[badge] : 0;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {label}
                    {n > 0 && (
                      <span className={`ml-auto rounded-full px-1.5 text-[11px] font-medium tabular-nums ${badge === "overdue" ? "bg-danger-soft text-destructive" : "bg-muted text-foreground"}`}
                        aria-label={badge === "overdue" ? `${n} overdue` : `${n} open recommendations`}>
                        {n}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SearchButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={() => { onClick?.(); openCommandPalette(); }}
      className="mx-2 mb-3 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
    >
      <Search className="size-4" /> Search or ask…
      <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Main" className="hidden w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="px-4 py-4"><Brand /></div>
        <SearchButton />
        <Links />
        <div className="mt-auto flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
          Governed by Snowflake RBAC
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b bg-background/90 px-3 backdrop-blur md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="px-4 py-4"><Brand /></div>
            <SearchButton onClick={() => setOpen(false)} />
            <Links onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Brand />
        <ThemeToggle />
      </div>
    </>
  );
}
