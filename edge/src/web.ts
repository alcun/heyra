// One origin: /v1/ and /healthz are the API, and everything else is the built
// Astro page. Static files are only ever read from inside the web root, after
// following any links.

import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

type Fetch = (request: Request) => Response | Promise<Response>;

// Everything, fonts included, comes from this origin; the microphone is for
// this page only; nobody may frame it. HEYRA_CONNECT_SRC may add hosts the page
// may send to (space-separated), e.g. an analytics endpoint.
const extraConnect = (process.env.HEYRA_CONNECT_SRC ?? "")
  .split(/\s+/)
  .filter((h) => /^https:\/\/[a-z0-9.-]+$/i.test(h))
  .join(" ");
export const PAGE_HEADERS = {
  "content-security-policy": `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'${extraConnect ? " " + extraConnect : ""}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
  "permissions-policy": "microphone=(self), camera=(), geolocation=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "cache-control": "public, max-age=300",
};

export function withWeb(api: Fetch, webRoot?: string): Fetch {
  if (!webRoot) return api;
  const root = realpathSync(resolve(webRoot));
  return async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/healthz" || pathname.startsWith("/v1/")) return api(request);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Not found", { status: 404 });
    let wanted: string;
    try { wanted = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, ""); }
    catch { return new Response("Not found", { status: 404, headers: PAGE_HEADERS }); }
    for (const candidate of [resolve(root, wanted), resolve(root, wanted, "index.html")]) {
      if (!candidate.startsWith(root + sep)) continue;
      const file = Bun.file(candidate);
      if (!(await file.exists())) continue;
      let real: string;
      try { real = realpathSync(candidate); } catch { continue; }
      if (real.startsWith(root + sep)) return new Response(file, { headers: PAGE_HEADERS });
    }
    return new Response("Not found", { status: 404, headers: PAGE_HEADERS });
  };
}
