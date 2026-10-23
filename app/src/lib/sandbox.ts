import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { Sandbox } from "@vercel/sandbox";

const SANDBOX_DIR = path.join(process.cwd(), "sandbox");
const SEED_FILES = [
  "package.json",
  "agent.mjs",
  ".claude/skills/sales-briefing/SKILL.md",
  ".claude/skills/render-chart/SKILL.md",
  ".claude/skills/build-dashboard/SKILL.md",
  ".claude/skills/create-action-item/SKILL.md",
];

function credentials() {
  // On Vercel, OIDC is picked up automatically. Locally, use `vercel env pull`
  // (VERCEL_OIDC_TOKEN) or an access token + team/project ids.
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env;
  return VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID
    ? { token: VERCEL_TOKEN, teamId: VERCEL_TEAM_ID, projectId: VERCEL_PROJECT_ID }
    : {};
}

async function seed(sandbox: Sandbox) {
  const files = await Promise.all(
    SEED_FILES.map(async (p) => ({
      path: p,
      content: await readFile(path.join(SANDBOX_DIR, p)),
    })),
  );
  await sandbox.writeFiles(files);
  const install = await sandbox.runCommand("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"]);
  if (install.exitCode !== 0) {
    throw new Error(`sandbox npm install failed: ${await install.stderr()}`);
  }
}

/** One sandbox per chat, reused across turns while it stays alive. */
export async function getChatSandbox(chatId: string): Promise<Sandbox> {
  return Sandbox.getOrCreate({
    name: `sales-chat-${chatId}`,
    runtime: "node24",
    timeout: 30 * 60 * 1000,
    resources: { vcpus: 2 },
    onCreate: seed,
    ...credentials(),
  });
}

export type SandboxEvent = Record<string, unknown> & { type: string };

/**
 * Run one agent turn and yield parsed JSON-line events from stdout.
 * Secrets go to this command's env only, never to the sandbox defaults.
 */
export async function* runAgentTurn(
  sandbox: Sandbox,
  prompt: string,
  history: { role: string; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<SandboxEvent> {
  await sandbox.writeFiles([
    { path: "input.json", content: JSON.stringify({ prompt, history }) },
  ]);

  const cmd = await sandbox.runCommand({
    cmd: "node",
    args: ["agent.mjs"],
    detached: true,
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      CLAUDE_MODEL: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",
      SNOWFLAKE_MCP_URL: process.env.SNOWFLAKE_MCP_URL ?? "",
      SNOWFLAKE_PAT: process.env.SNOWFLAKE_PAT ?? "",
    },
  });

  let buf = "";
  let stderr = "";
  for await (const log of cmd.logs({ signal })) {
    if (log.stream === "stderr") {
      stderr = (stderr + log.data).slice(-4000);
      continue;
    }
    buf += log.data;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line) as SandboxEvent;
      } catch {
        // non-JSON output (e.g. warnings) is ignored
      }
    }
  }

  const done = await cmd.wait();
  if (done.exitCode !== 0) {
    yield { type: "error", text: `Agent exited with ${done.exitCode}. ${stderr.trim()}`.trim() };
  }
}
