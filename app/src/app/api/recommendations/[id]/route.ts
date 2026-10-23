import { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { acceptRecommendation, dismissRecommendation } from "@/lib/db";

// POST { decision: "accept" } → ACCEPT_RECOMMENDATION (creates an action item)
// POST { decision: "dismiss", reason? } → DISMISS_RECOMMENDATION
export async function POST(req: NextRequest, ctx: RouteContext<"/api/recommendations/[id]">) {
  const { id } = await ctx.params;
  const { decision, reason } = (await req.json()) as { decision?: string; reason?: string };
  return json(async () => {
    if (decision === "accept") return acceptRecommendation(id);
    if (decision === "dismiss") return dismissRecommendation(id, reason ?? null);
    throw new Error("decision must be accept or dismiss");
  });
}
