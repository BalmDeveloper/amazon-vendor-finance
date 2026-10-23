import { connection } from "next/server";
import { json } from "@/lib/api";
import { listDashboards } from "@/lib/db";

// GET /api/dashboards → published dashboards plus your drafts
export async function GET() {
  await connection();
  return json(listDashboards);
}
