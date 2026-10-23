import { connection } from "next/server";
import { json } from "@/lib/api";
import { getMetrics } from "@/lib/db";

// GET /api/metrics → success metrics for the Today page
export async function GET() {
  await connection();
  return json(getMetrics);
}
