import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { acceptRecommendation, dismissRecommendation } from "@/lib/db";

// POST { action: "accept", owner? } → ACCEPT_RECOMMENDATION (creates an action item)
// POST { action: "dismiss", reason? } → DISMISS_RECOMMENDATION
export async function POST(req: NextRequest, ctx: RouteContext<"/api/recommendations/[id]">) {
  const { id } = await ctx.params;
  const { action, owner, reason } = (await req.json()) as { action?: string; owner?: string; reason?: string };
  return json(async () => {
    if (action === "accept") return acceptRecommendation(id, owner ?? null);
    if (action === "dismiss") return dismissRecommendation(id, reason ?? null);
    throw new Error("action must be accept or dismiss");
  });
}
