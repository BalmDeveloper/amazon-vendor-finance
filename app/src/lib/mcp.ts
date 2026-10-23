import "server-only";

/** Lists tools on the Snowflake managed MCP server: a cheap connectivity/auth check. */
export async function listMcpTools(): Promise<{
  ok: boolean;
  tools: { name: string; description?: string }[];
  error?: string;
}> {
  const url = process.env.SNOWFLAKE_MCP_URL;
  const pat = process.env.SNOWFLAKE_PAT;
  if (!url || !pat) return { ok: false, tools: [], error: "SNOWFLAKE_MCP_URL / SNOWFLAKE_PAT not set" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${pat}`,
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      cache: "no-store",
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, tools: [], error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    const json = JSON.parse(body.startsWith("data:") ? body.replace(/^data:\s*/m, "") : body);
    if (json.error) return { ok: false, tools: [], error: json.error.message };
    return { ok: true, tools: json.result?.tools ?? [] };
  } catch (e) {
    return { ok: false, tools: [], error: (e as Error).message };
  }
}
