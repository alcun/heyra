// llms.txt with the rest of the site inlined, so an assistant can read it in one request.
import type { APIRoute } from "astro";
import { readFileSync } from "node:fs";
import { faq } from "../data/faq";
import bench from "../data/bench.json";

export const GET: APIRoute = () => {
  const intro = readFileSync(new URL("../../public/llms.txt", import.meta.url), "utf8").trim();
  const questions = faq.map(([q, a]) => `### ${q}\n\n${a}`).join("\n\n");
  const names = bench.models.map((m) => m.name);
  const rows = bench.sets.map((s) => `| ${s.name} (${s.source}) | ${bench.models.map((m) => (s.v as Record<string, number>)[m.id]?.toFixed(1) ?? "").join(" | ")} |`);
  const table = [`| Speech | ${names.join(" | ")} |`, `|---|${names.map(() => "---").join("|")}|`, ...rows].join("\n");
  const body = `${intro}\n\n## Questions\n\n${questions}\n\n## Bench\n\nWords wrong in 100 (fewer is better), ${bench.clips} public English clips, ${bench.date}, ${bench.engine}. Bark 3.0 Clean leaves out "um" and "uh" on purpose, so it scores worse on leaderboard sets that keep them.\n\n${table}\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
