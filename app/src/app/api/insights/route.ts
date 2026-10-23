import { connection } from "next/server";
import { json } from "@/lib/api";
import { listInsights } from "@/lib/db";

// GET /api/insights → active insights
export async function GET() {
  await connection();
  return json(listInsights);
}
