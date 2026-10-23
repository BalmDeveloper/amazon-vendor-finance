import { connection } from "next/server";
import { json } from "@/lib/api";
import { listInsights, listRecommendations } from "@/lib/db";

// GET /api/insights → active insights and open recommendations
export async function GET() {
  await connection();
  return json(async () => {
    const [insights, recommendations] = await Promise.all([listInsights(), listRecommendations()]);
    return { insights, recommendations };
  });
}
