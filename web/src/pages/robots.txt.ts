// The sitemap line needs an absolute address, so it appears only when the
// build knows its public site (HEYRA_SITE).
import type { APIRoute } from "astro";

const AGENTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"];

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\n# Assistants and answer engines are welcome too.\n${AGENTS.map((a) => `User-agent: ${a}\nAllow: /\n`).join("\n")}${site ? `\nSitemap: ${new URL("/sitemap.xml", site).href}\n` : ""}`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
