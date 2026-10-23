"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, LayoutDashboard, MessageSquare, Plug, Snowflake } from "lucide-react";

const LINKS = [
  { href: "/", label: "Assistant", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboards", icon: LayoutDashboard },
  { href: "/actions", label: "Action items", icon: CheckSquare },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex w-56 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Snowflake className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Sales Intelligence</div>
          <div className="text-xs text-muted-foreground">Claude × Snowflake</div>
        </div>
      </div>
      <ul className="space-y-0.5 px-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
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
      <div className="mt-auto border-t px-4 py-3 text-xs text-muted-foreground">
        Governed by Snowflake RBAC
      </div>
    </nav>
  );
}
