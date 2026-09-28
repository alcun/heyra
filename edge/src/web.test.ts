import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withWeb } from "./web.ts";

const root = mkdtempSync(join(tmpdir(), "heyra-web-"));
writeFileSync(join(root, "index.html"), "<h1>Heyra</h1>");
writeFileSync(join(root, "heyra.js"), "// page");
afterAll(() => rmSync(root, { recursive: true }));

const fetch = withWeb(() => new Response("api"), root);
const get = (path: string, method = "GET") => fetch(new Request(`http://heyra.test${path}`, { method }));

test("the page is served with its security headers", async () => {
  const r = await get("/");
  expect(await r.text()).toBe("<h1>Heyra</h1>");
  expect(r.headers.get("permissions-policy")).toContain("microphone=(self)");
  expect(r.headers.get("content-security-policy")).toContain("connect-src 'self'");
  expect(r.headers.get("content-security-policy")).not.toContain("googleapis");
});
test("static files are served", async () => expect(await (await get("/heyra.js")).text()).toBe("// page"));
test("/v1/ and /healthz go to the API", async () => {
  expect(await (await get("/v1/transcribe", "POST")).text()).toBe("api");
  expect(await (await get("/healthz")).text()).toBe("api");
});
test("nothing outside the web root is served", async () => {
  expect((await get("/../package.json")).status).toBe(404);
  expect((await get("/%2e%2e/%2e%2e/etc/passwd")).status).toBe(404);
});
test("a malformed address is a 404, not an error", async () => expect((await get("/%")).status).toBe(404));
test("a link out of the web root is not followed", async () => {
  const { symlinkSync } = await import("node:fs");
  symlinkSync("/etc/hostname", join(root, "leak.txt"));
  expect((await get("/leak.txt")).status).toBe(404);
});
test("other methods on the page are refused", async () => expect((await get("/", "POST")).status).toBe(404));
