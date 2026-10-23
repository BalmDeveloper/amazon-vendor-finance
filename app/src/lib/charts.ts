import type { ChartConfig, ChartSpec } from "./types";

type Row = Record<string, string | number | null>;
type Unit = "USD" | "%" | undefined;

const NUMERIC = new Set(["fixed", "real", "number", "float", "decimal"]);
const TEMPORAL = /^(date|timestamp|time)/i;
const TIME_NAME = /(MONTH|WEEK|DATE|DAY|QUARTER|YEAR|PERIOD)$/i;
const RATE_NAME = /(RATE|SHARE|PCT|PERCENT|RATIO)$/i;
const COUNT_NAME = /(COUNT|CLAIMS|DISPUTES|INVOICES|PAYMENTS|ITEMS|_N)$/i;

export const pretty = (k: string) => k.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const toNumber = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Column metadata from a Snowflake result set (rowType). */
export type Column = { name: string; type: string; scale?: number };

function unitFor(col: Column): Unit {
  if (RATE_NAME.test(col.name)) return "%";
  if (COUNT_NAME.test(col.name) || col.scale === 0) return undefined;
  return "USD";
}

function scaleRows(rows: Row[], cols: string[], unit: Unit): Row[] {
  if (unit !== "%") return rows;
  // Rates come back as 0–1; charts show percentages.
  return rows.map((r) => ({ ...r, ...Object.fromEntries(cols.map((c) => [c, r[c] == null ? null : Number(r[c]) * 100])) }));
}

/** Builds rows from a Snowflake JSON result set ({ data: string[][], resultSetMetaData.rowType }). */
export function resultSetRows(resultSet: { data?: unknown[][]; resultSetMetaData?: { rowType?: Column[] } }) {
  const cols = resultSet.resultSetMetaData?.rowType ?? [];
  const rows = (resultSet.data ?? []).map((r) =>
    Object.fromEntries(cols.map((c, i) => [c.name, NUMERIC.has(c.type.toLowerCase()) ? toNumber(r[i]) : (r[i] as string | null)])),
  ) as Row[];
  return { cols, rows };
}

/** Picks a sensible chart for an agent result: one row → KPIs, time → line, few categories → bar, else table. */
export function autoChart(title: string, cols: Column[], rows: Row[], sql?: string): ChartSpec {
  const numeric = cols.filter((c) => NUMERIC.has(c.type.toLowerCase()));
  const labels = cols.filter((c) => !NUMERIC.has(c.type.toLowerCase()));
  const base = { title, sql };

  if (rows.length === 1 && numeric.length && !labels.length) {
    return {
      ...base,
      type: "kpi",
      yKeys: numeric.map((c) => c.name),
      unit: unitFor(numeric[0]),
      data: numeric.map((c) => {
        const unit = unitFor(c);
        const v = toNumber(rows[0][c.name]);
        return { label: pretty(c.name), value: v == null ? null : unit === "%" ? v * 100 : v, unit: unit ?? "" };
      }),
    };
  }
  if (!numeric.length || !labels.length || rows.length > 24) return { ...base, type: "table", data: rows };

  const x = labels.find((c) => TEMPORAL.test(c.type) || TIME_NAME.test(c.name)) ?? labels[0];
  const unit = unitFor(numeric[0]);
  // One unit per chart: plot the columns that share the first measure's unit.
  const y = numeric.filter((c) => unitFor(c) === unit).map((c) => c.name);
  const isTime = TEMPORAL.test(x.type) || TIME_NAME.test(x.name);
  const data = scaleRows(isTime ? [...rows].sort((a, b) => String(a[x.name]).localeCompare(String(b[x.name]))) : rows, y, unit);
  return { ...base, type: isTime ? "line" : "bar", xKey: x.name, yKeys: y, unit, data, variant: !isTime && rows.length > 6 ? "horizontal" : undefined };
}

/** Builds a chart for a stored widget from its query result and CHART_CONFIG. */
export function widgetChart(
  w: { title: string; description?: string | null; widget_type: string; chart_config?: ChartConfig | null },
  rows: Row[],
): ChartSpec {
  const cfg = w.chart_config ?? {};
  const unit: Unit = cfg.format === "usd" ? "USD" : cfg.format === "percent" ? "%" : undefined;
  const cols = Object.keys(rows[0] ?? {});
  const y = cfg.y?.filter((c) => cols.includes(c)).length ? cfg.y.filter((c) => cols.includes(c)) : cols.filter((c) => typeof rows[0]?.[c] === "number");
  const x = cfg.x && cols.includes(cfg.x) ? cfg.x : cols.find((c) => !y.includes(c));
  const type = (["kpi", "line", "bar", "area", "pie", "table"].includes(w.widget_type) ? w.widget_type : "table") as ChartSpec["type"];
  const base = { title: w.title, description: w.description ?? undefined, span: cfg.span, variant: cfg.variant };

  if (type === "kpi") {
    const v = toNumber(rows[0]?.[y[0]]);
    return { ...base, type, unit, data: [{ label: w.title, value: v == null ? null : unit === "%" ? v * 100 : v }] };
  }
  const data = scaleRows(rows, y, unit);
  return { ...base, type, unit, xKey: x, yKeys: y, data };
}

/** Normalises driver rows (numbers may arrive as strings; dates as Date objects). */
export function plainRows(rows: Record<string, unknown>[]): Row[] {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "number" || v === null ? v : typeof v === "string" && v !== "" && !isNaN(Number(v)) && /^-?[\d.]+(e-?\d+)?$/i.test(v) ? Number(v) : String(v ?? ""),
      ]),
    ),
  ) as Row[];
}
