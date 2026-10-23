import "server-only";
import snowflake from "snowflake-sdk";

snowflake.configure({ logLevel: "ERROR" });

type Pool = ReturnType<typeof snowflake.createPool>;

const globalForPool = globalThis as unknown as { sfPool?: Pool };

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function getPool(): Pool {
  if (!globalForPool.sfPool) {
    globalForPool.sfPool = snowflake.createPool(
      {
        account: env("SNOWFLAKE_ACCOUNT"),
        username: env("SNOWFLAKE_USER"),
        authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
        token: env("SNOWFLAKE_PAT"),
        role: process.env.SNOWFLAKE_ROLE ?? "SALES_APP_ROLE",
        warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "SALES_INTELLIGENCE_WH",
        database: process.env.SNOWFLAKE_DATABASE ?? "SALES_INTELLIGENCE",
        schema: process.env.SNOWFLAKE_SCHEMA ?? "APP",
      } as snowflake.ConnectionOptions,
      { max: 5, min: 0 },
    );
  }
  return globalForPool.sfPool;
}

export type Bind = string | number | boolean | null;

/** Run a parameterized statement. Always use binds for user input. */
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  binds: Bind[] = [],
): Promise<T[]> {
  return getPool().use(
    (conn) =>
      new Promise<T[]>((resolve, reject) => {
        conn.execute({
          sqlText,
          binds: binds as snowflake.Binds,
          complete: (err, _stmt, rows) =>
            err ? reject(err) : resolve((rows ?? []) as T[]),
        });
      }),
  );
}

/** Snowflake returns upper-case column names; normalise to lower-case keys. */
export function lower<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map(
    (r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]),
      ) as T,
  );
}
