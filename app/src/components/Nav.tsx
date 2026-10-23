"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { CheckSquare, LayoutDashboard, Lightbulb, Menu, MessageSquare, Moon, Plug, Snowflake, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const LINKS = [
  { href: "/", label: "Assistant", icon: MessageSquare },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/dashboard", label: "Dashboards", icon: LayoutDashboard },
  { href: "/actions", label: "Action items", icon: CheckSquare },
  { href: "/integrations", label: "Integrations", icon: Plug },
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
  return (
    <ul className="space-y-0.5 px-2">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
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
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Main" className="hidden w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="px-4 py-4"><Brand /></div>
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
            <Links onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Brand />
        <ThemeToggle />
      </div>
    </>
  );
}
