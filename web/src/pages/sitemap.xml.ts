// A static build writes the body whatever the status, so without a public
// site (HEYRA_SITE) this is an empty sitemap rather than a 404.
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${site ? ["/", "/bench"].map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>\n`).join("") : ""}</urlset>\n`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
