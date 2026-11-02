// llms.txt with the rest of the site inlined, so an assistant can read it in one request.
import type { APIRoute } from "astro";
import { readFileSync } from "node:fs";
import { faq } from "../data/faq";
import bench from "../data/bench.json";

export const GET: APIRoute = () => {
  const intro = readFileSync(new URL("../../public/llms.txt", import.meta.url), "utf8").trim();
  const questions = faq.map(([q, a]) => `### ${q}\n\n${a}`).join("\n\n");
  const names = bench.models.map((m) => m.name);
  const cell = (v: number | null | undefined) => (v == null ? "" : v.toFixed(1));
  const rows = [
    `| Average (seven sets) | ${bench.models.map((m) => cell(m.average)).join(" | ")} |`,
    ...bench.sets.map((s) => `| ${s.name} (${s.source}) | ${bench.models.map((m) => cell((m.v as Record<string, number>)[s.id])).join(" | ")} |`),
    `| Speed, times real time | ${bench.models.map((m) => String(m.speed)).join(" | ")} |`,
    `| Size, MB | ${bench.models.map((m) => String(m.mb)).join(" | ")} |`,
  ];
  const table = [`| Speech | ${names.join(" | ")} |`, `|---|${names.map(() => "---").join("|")}|`, ...rows].join("\n");
  const body = `${intro}\n\n## Questions\n\n${questions}\n\n## Bench\n\nWords wrong in 100 (fewer is better), ${bench.clips} public English clips, ${bench.date}, ${bench.engine}, fed in 15-second pieces as Heyra sends a take. Models in Heyra: ${bench.models.filter((m) => m.heyra).map((m) => m.name).join(", ")}. Bark 3.0 Clean leaves out "um" and "uh" on purpose, so it scores worse on leaderboard sets that keep them.\n\n${table}\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
