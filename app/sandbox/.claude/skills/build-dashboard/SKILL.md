---
name: build-dashboard
description: Build a complete multi-widget dashboard in one step (KPIs, charts, tables, lightweight HTML visuals) that the web app saves and opens on the Dashboard page. Use when the user asks for a dashboard, report, overview, scorecard, or "show me everything about X".
---

# Build dashboard

Fast path: gather data with as few Snowflake calls as possible, then emit **one**
fenced block tagged `dashboard`. The app saves it to Snowflake and links it in chat.

## Workflow
1. Plan 4–8 widgets. Group the questions so 2–4 calls to
   `mcp__snowflake__sales_intelligence_agent` cover everything. Ask each call for a
   table with explicit column names.
2. Use only numbers the tool returned. If a widget's data didn't come back, drop it.
3. Emit the block, then add a 2–4 sentence takeaway in text.

```dashboard
{
  "name": "Sales pipeline overview",
  "description": "Deals, reps and win rate",
  "widgets": [
    { "type": "kpi", "title": "Headline", "span": 3, "unit": "USD",
      "data": [ { "label": "Total pipeline", "value": 1250000 },
                { "label": "Won", "value": 480000, "delta": 12.5 } ] },
    { "type": "bar", "title": "Deal value by rep", "span": 2, "unit": "USD",
      "xKey": "rep", "yKeys": ["deal_value"],
      "data": [ { "rep": "Sarah Johnson", "deal_value": 95000 } ] },
    { "type": "pie", "title": "Deals by stage", "xKey": "stage", "yKeys": ["deals"],
      "data": [ { "stage": "Closed", "deals": 6 }, { "stage": "Negotiation", "deals": 3 } ] },
    { "type": "html", "title": "Win rate by product line", "height": 180,
      "data": [ { "product": "Enterprise Suite", "win_rate": 0.67 } ],
      "html": "<div id='r' class='grid'></div><script>r.innerHTML=DATA.map(d=>`<div><div class='row'><span>${d.product}</span><span class='num muted' style='margin-left:auto'>${Math.round(d.win_rate*100)}%</span></div><div class='bar' style='width:${d.win_rate*100}%'></div></div>`).join('')</script>" },
    { "type": "table", "title": "Pending deals", "span": 3, "unit": "USD",
      "data": [ { "customer": "TechCorp", "rep": "Sarah Johnson", "deal_value": 75000 } ] }
  ]
}
```

## Widget types
Same as the render-chart skill: `kpi`, `bar`, `line`, `area`, `pie`, `table`, `html`.
- `span`: grid width 1–3 (default 1; `kpi`/`table` default to 3). Lay out rows that add up to 3.
- Order: KPIs first, then the main trend or ranking (`span: 2`), then breakdowns, then detail tables.

## HTML widgets (lightweight custom visuals)
Use `html` when no built-in type fits, for example progress bars, heat-map cells,
leaderboards, sparklines, funnels or bullet charts. Keep them tiny and self-contained:
- The widget's `data` array is injected as `window.DATA`. Render from it; never hard-code numbers.
- Plain HTML, CSS and vanilla JS only. No external scripts, fonts, images or fetch (blocked by CSP).
- Built-in helpers: CSS vars `--c1..--c5` (chart palette) and `--muted`; classes
  `.row`, `.grid`, `.bar` (8px rounded bar), `.num`, `.muted`; styled `table`.
- Inline SVG is fine for sparklines and funnels. Set `height` (px, default 240).
- The block must stay valid JSON: use single quotes inside HTML attributes and backticks in JS.
