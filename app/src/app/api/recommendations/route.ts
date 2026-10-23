import { connection } from "next/server";
import { json } from "@/lib/api";
import { listRecommendations } from "@/lib/db";

// GET /api/recommendations → open recommendations, highest estimated value first
export async function GET() {
  await connection();
  return json(listRecommendations);
}
