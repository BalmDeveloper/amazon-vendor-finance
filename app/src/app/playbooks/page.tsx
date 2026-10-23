"use client";
import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AREA } from "@/lib/areas";
import { usd } from "@/lib/format";
import { SAMPLE_PLAYBOOKS } from "@/lib/sample";

export default function PlaybooksPage() {
  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-8">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><ListChecks className="size-5" /> Playbooks</h1>
          <p className="text-sm text-muted-foreground">Recurring multi-step work, done the same way every time: pick, assign, track.</p>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-8 md:grid-cols-3">
        {SAMPLE_PLAYBOOKS.map((p) => {
          const A = AREA[p.problem_area];
          return (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{A && <A.icon className="size-3.5" />}{A?.label}</div>
                <CardTitle className="text-base">{p.title}</CardTitle>
                <CardDescription>{p.summary}</CardDescription>
                <CardAction className="text-right">
                  <div className="font-semibold tabular-nums text-success">{usd(p.estimated_value_usd)}</div>
                  <div className="text-[11px] text-muted-foreground">at stake</div>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1">
                <ol className="space-y-1.5 text-sm">
                  {p.steps.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2 text-muted-foreground">
                      <span className="flex size-5 items-center justify-center rounded-full border text-[11px] tabular-nums">{i + 1}</span>{s.title}
                    </li>
                  ))}
                </ol>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Link href={`/playbooks/${p.id}`} className={`${buttonVariants()} w-full`}>Start <ArrowRight /></Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
