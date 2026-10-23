import { connection } from "next/server";
import { sql } from "@/lib/snowflake";

async function check<T>(fn: () => Promise<T>) {
  const t = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: (e as Error).message };
  }
}

// Each check runs as the signed-in user, so the page shows what *you* can reach.
export async function GET() {
  await connection();
  const [identity, agent, semanticView, search] = await Promise.all([
    check(async () => (await sql<{ user: string; role: string; warehouse: string }>(
      "SELECT CURRENT_USER() AS user, CURRENT_ROLE() AS role, CURRENT_WAREHOUSE() AS warehouse",
    ))[0]),
    check(async () => {
      const rows = await sql<{ name: string }>("SHOW AGENTS LIKE 'AMAZON_VENDOR_FINANCE_AGENT' IN SCHEMA AMAZON_FINANCE_APP.APP");
      if (!rows.length) throw new Error("Agent not found or no USAGE");
      return { name: "AMAZON_FINANCE_APP.APP.AMAZON_VENDOR_FINANCE_AGENT" };
    }),
    check(async () => (await sql<{ total_invoiced: number }>(
      "SELECT * FROM SEMANTIC_VIEW(AMAZON_FINANCE_APP.SEMANTIC.AMAZON_VENDOR_FINANCE_SV METRICS invoices.total_invoiced)",
    ))[0]),
    check(async () => {
      const [row] = await sql<{ r: string }>(
        "SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('AMAZON_FINANCE_APP.OPS.OPS_SEARCH', '{\"query\": \"shortage\", \"columns\": [\"title\"], \"limit\": 1}') AS r",
      );
      return { results: (JSON.parse(row.r).results ?? []).length };
    }),
  ]);
  return Response.json({ identity, agent, semanticView, search });
}
