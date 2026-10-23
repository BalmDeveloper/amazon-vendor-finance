// Runs inside the Vercel Sandbox. Reads input.json, runs one Claude Agent SDK
// turn with the Snowflake managed MCP server + project skills, and writes one
// JSON event per line to stdout for the Next.js host to stream to the browser.
import { readFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";

const emit = (e) => process.stdout.write(JSON.stringify(e) + "\n");

const input = JSON.parse(await readFile(new URL("./input.json", import.meta.url), "utf8"));
const { prompt, history = [] } = input;

const transcript = history
  .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
  .join("\n\n");

const SYSTEM = `You are the Sales Intelligence copilot inside a web app.
Today's date is ${new Date().toISOString().slice(0, 10)}.
- For ANY question about sales deals, revenue, reps, win rates, sales call transcripts,
  Tesco retail sales, or Amazon vendor finance, call the Snowflake tool
  mcp__snowflake__sales_intelligence_agent. Never invent numbers.
- Use the sales-briefing skill to structure answers, the render-chart skill whenever
  results have 2+ comparable data points, the build-dashboard skill when the user asks
  for a dashboard / report / overview, and the create-action-item skill when the
  user asks for next steps / follow-ups or the data clearly implies them.
- Answer in concise markdown.`;

const fullPrompt = transcript
  ? `Conversation so far:\n${transcript}\n\nUser: ${prompt}`
  : prompt;

let finalText = "";
try {
  for await (const msg of query({
    prompt: fullPrompt,
    options: {
      model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
      cwd: process.cwd(),
      systemPrompt: { type: "preset", preset: "claude_code", append: SYSTEM },
      settingSources: ["project"],
      skills: "all",
      mcpServers: {
        snowflake: {
          type: "http",
          url: process.env.SNOWFLAKE_MCP_URL,
          headers: {
            Authorization: `Bearer ${process.env.SNOWFLAKE_PAT}`,
            "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
          },
          timeout: 180_000,
        },
      },
      allowedTools: ["mcp__snowflake__sales_intelligence_agent", "Skill", "Read"],
      disallowedTools: ["Bash", "Write", "Edit", "WebFetch", "WebSearch"],
      permissionMode: "dontAsk",
      maxTurns: 12,
    },
  })) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text" && block.text.trim()) {
          emit({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          emit({ type: "tool", name: block.name, input: block.input });
        }
      }
    } else if (msg.type === "user" && Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        if (block.type === "tool_result") {
          emit({ type: "tool_result", name: block.tool_use_id, ok: !block.is_error });
        }
      }
    } else if (msg.type === "result") {
      if (msg.subtype === "success") finalText = msg.result ?? "";
      else emit({ type: "error", text: `Agent stopped: ${msg.subtype}` });
    }
  }
  emit({ type: "final", text: finalText });
} catch (err) {
  emit({ type: "error", text: String(err?.message ?? err) });
  process.exitCode = 1;
}
