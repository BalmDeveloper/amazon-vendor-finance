"use client";
import { useMemo } from "react";

// Agent-authored HTML widgets run in an iframe with sandbox="allow-scripts" and
// no allow-same-origin, so they get an opaque origin: no access to the app's
// cookies, storage, DOM or APIs. The CSP also blocks all network requests, so
// widgets can only render the data we inject as window.DATA.
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:";

const BASE_CSS = `
  :root { --c1: oklch(0.62 0.17 240); --c2: oklch(0.70 0.17 50); --c3: oklch(0.65 0.15 160);
          --c4: oklch(0.58 0.19 295); --c5: oklch(0.65 0.20 15); --muted: #71717a; --border: #e4e4e7; }
  * { box-sizing: border-box; }
  html, body { margin: 0; font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; color: #18181b; background: transparent; }
  .muted { color: var(--muted); } .num { font-variant-numeric: tabular-nums; }
  .row { display: flex; gap: 8px; align-items: center; } .grid { display: grid; gap: 8px; }
  .bar { height: 8px; border-radius: 4px; background: var(--c1); }
  table { width: 100%; border-collapse: collapse; } td, th { padding: 4px 6px; border-bottom: 1px solid var(--border); text-align: left; }
`;

export function HtmlWidget({ html, data, height }: { html: string; data: unknown; height: number }) {
  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>${BASE_CSS}</style>
<script>window.DATA = ${JSON.stringify(data ?? []).replace(/</g, "\\u003c")};</script>
</head><body>${html}</body></html>`,
    [html, data],
  );
  return (
    <iframe
      title="widget"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full border-0"
      style={{ height }}
    />
  );
}
