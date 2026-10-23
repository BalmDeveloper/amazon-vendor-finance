---
name: render-chart
description: Turn tabular or numeric results (from the Snowflake sales agent) into a chart the web app renders natively. Use whenever an answer contains 2+ comparable numbers, a ranking, a breakdown, or a trend over time.
---

# Render chart

Emit exactly one fenced block per chart, with the language tag `chart` and a JSON body.
The app removes the block from your text and draws it, so don't describe the JSON.

```chart
{
  "type": "bar",
  "title": "Deal value by sales rep",
  "xKey": "rep",
  "yKeys": ["deal_value"],
  "unit": "USD",
  "data": [
    { "rep": "Sarah Johnson", "deal_value": 95000 },
    { "rep": "Mike Chen", "deal_value": 72000 }
  ]
}
```

## Rules
- `type`: `bar` (rankings/categories), `line` or `area` (time series, x sorted ascending),
  `pie` (share of total, ≤ 8 slices), `table` (many columns), `kpi` (1–4 headline numbers;
  use `data: [{ "label": "...", "value": 123, "delta": 4.2 }]`, where `delta` is an optional % change),
  `html` (tiny custom visual; see the build-dashboard skill for the `html` + `window.DATA` contract).
- For more than 2 charts on one topic, use the build-dashboard skill instead.
- Only use numbers that came back from the Snowflake tool. Never estimate or pad data.
- Values must be plain JSON numbers (no "$", commas, or "%"). Put units in `unit`.
- `xKey` and every entry in `yKeys` must be keys present in every `data` row.
- Keep ≤ 50 rows; aggregate or take the top N if needed and say so in `description`.
- Still give a 1–3 sentence text takeaway alongside the chart.
