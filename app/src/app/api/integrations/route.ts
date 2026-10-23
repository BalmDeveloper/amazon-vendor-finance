import { connection } from "next/server";
import { listMcpTools } from "@/lib/mcp";
import { query } from "@/lib/snowflake";

async function check<T>(fn: () => Promise<T>) {
  const t = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: (e as Error).message };
  }
}

export async function GET() {
  await connection();
  const [warehouse, mcp] = await Promise.all([
    check(() => query("SELECT CURRENT_ROLE() AS ROLE, CURRENT_WAREHOUSE() AS WH")),
    check(listMcpTools),
  ]);
  return Response.json({
    snowflake: warehouse,
    mcp: mcp.ok ? { ms: mcp.ms, ...(mcp.value as object) } : mcp,
    anthropic: { ok: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.CLAUDE_MODEL ?? "claude-opus-5-5" },
    sandbox: {
      ok: Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN),
      note: "Uses Vercel OIDC on deploy; run `vercel env pull` locally.",
    },
  });
}
