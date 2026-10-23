import "server-only";

/** Runs a route handler body and returns JSON; errors (e.g. a procedure's validation message) become 400s. */
export async function json<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    const message = (e as Error).message ?? "Request failed";
    console.error("[api]", message);
    return Response.json({ error: message }, { status: 400 });
  }
}
