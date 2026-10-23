import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["snowflake-sdk"],
  // agent.mjs + skills are read at runtime and copied into the Vercel Sandbox
  outputFileTracingIncludes: {
    "/api/chat": ["./sandbox/package.json", "./sandbox/agent.mjs", "./sandbox/.claude/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
