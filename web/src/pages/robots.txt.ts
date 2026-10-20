// The sitemap line needs an absolute address, so it appears only when the
// build knows its public site (HEYRA_SITE).
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n${site ? `\nSitemap: ${new URL("/sitemap.xml", site).href}\n` : ""}`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
