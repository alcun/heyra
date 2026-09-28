// Heyra's API: self-hosted speech to text. POST a short WAV to
// /v1/transcribe, get the words back.
// Anyone may use a free allowance: so many clips a day per visitor, and a daily
// ceiling for everyone together. A key gets its own bigger allowance, two
// places that strangers cannot take, and the front of the queue. Audio is read
// in memory, transcribed and dropped: nothing is written to disk or logged.

import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Transcribe } from "./stt.ts";
import { readWav, WavError } from "./wav.ts";

export const MAX_SECONDS = 30;
// 30 s of 48 kHz stereo 16-bit is about 5.8 MB; anything larger is not a clip.
export const MAX_BYTES = 6 * 1024 * 1024;
const MIN_SECONDS = 0.3;
// Requests being uploaded, queued or transcribed at once; this bounds memory too.
// The last KEPT_FOR_KEYS places are only for callers with a key.
const MAX_IN_FLIGHT = 8, KEPT_FOR_KEYS = 2;
// An upload that has not arrived in this long is given up on, so slow senders
// cannot hold the eight places indefinitely.
const UPLOAD_MS = 20_000;

// Reads the body only after the caller has a place, stopping at the size cap
// or the time limit instead of buffering whatever arrives.
export class BodyError extends Error { constructor(public status: 408 | 413, message: string) { super(message); } }
export async function readCapped(req: Request, max = MAX_BYTES, ms = UPLOAD_MS): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length") || 0) > max) throw new BodyError(413, `Clips are limited to ${MAX_SECONDS} seconds`);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader(), parts: Uint8Array[] = [];
  let size = 0, late = false;
  // Cancelling ends the pending read as if the body were complete, so the
  // timeout is remembered rather than inferred.
  const timer = setTimeout(() => { late = true; reader.cancel().catch(() => {}); }, ms);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (late) throw new BodyError(408, "The upload took too long");
      if (done) break;
      size += value.byteLength;
      if (size > max) { reader.cancel().catch(() => {}); throw new BodyError(413, `Clips are limited to ${MAX_SECONDS} seconds`); }
      parts.push(value);
    }
  } catch (e) {
    if (e instanceof BodyError) throw e;
    throw new BodyError(408, "The upload took too long");
  } finally { clearTimeout(timer); }
  const out = new Uint8Array(size); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

export type Free = { perVisitor: number; daily: number; maxSeconds: number };
export type Options = {
  transcribe: Transcribe;
  keys: string[];
  keyLimit: number; // clips per key per day
  free: Free;
  today?: () => string;
};

const digest = (s: string) => createHash("sha256").update(s).digest();
const utcDay = () => new Date().toISOString().slice(0, 10);

// "abc,def": keys of 24 or more characters, each once. A setting that holds no
// keys at all is an error rather than silently none.
export function parseKeys(spec = ""): string[] {
  const keys = spec.split(",").map((s) => s.trim()).filter(Boolean);
  if (spec.trim() && !keys.length) throw new Error("KEYS is set but holds no keys");
  if (keys.some((k) => k.length < 24)) throw new Error("Each key in KEYS needs 24 or more characters");
  if (new Set(keys).size !== keys.length) throw new Error("KEYS has the same key twice");
  return keys;
}

export function createApp({ transcribe, keys, keyLimit, free, today = utcDay }: Options) {
  const known = keys.map((k, i) => ({ hash: digest(k), id: `key${i + 1}` }));
  // A key's id, or null for none; a key that matches nothing is undefined.
  const identify = (header?: string) => {
    if (!header) return null;
    const hash = digest(header.replace(/^Bearer\s+/i, ""));
    let id: string | undefined;
    for (const k of known) if (timingSafeEqual(hash, k.hash)) id = k.id;
    return id;
  };

  let day = today(), used = new Map<string, number>(), freeUsed = 0, keyedUsed = 0, inFlight = 0;
  const rollover = () => { const t = today(); if (t !== day) { day = t; used = new Map(); freeUsed = 0; keyedUsed = 0; } };
  const app = new Hono();

  // Any page may call it. Before the route, so refusals carry the header too;
  // without it a 429 reaches a page as an opaque CORS failure.
  app.use("/v1/transcribe", cors({ origin: "*", allowMethods: ["POST"], allowHeaders: ["authorization", "content-type"], maxAge: 86400 }));

  // Today's counts give an owner visibility without any analytics.
  app.get("/healthz", (c) => { rollover(); return c.json({ ok: true, busy: inFlight, free: free.daily > 0, today: { free: freeUsed, keyed: keyedUsed } }); });

  app.post("/v1/transcribe", async (c) => {
    const key = identify(c.req.header("authorization"));
    if (key === undefined) return c.json({ error: "Unknown key" }, 401);
    if (!key && free.daily === 0) return c.json({ error: "A key is needed" }, 401);
    // Behind a proxy that appends the caller's address, the visitor is the last
    // x-forwarded-for entry. Without such a proxy it can be forged.
    const who = key ?? `visitor:${(c.req.header("x-forwarded-for") || "").split(",").pop()?.trim() || "unknown"}`;

    // Check and reserve in one step, before anything waits, so simultaneous
    // requests cannot all slip under a limit. A clip that turns out unusable
    // or fails hands its reservation back, to the day it was taken from.
    rollover();
    if (inFlight >= MAX_IN_FLIGHT - (key ? 0 : KEPT_FOR_KEYS)) return c.json({ error: "Busy, try again in a moment" }, 503, { "retry-after": "2" });
    if ((used.get(who) ?? 0) >= (key ? keyLimit : free.perVisitor)) return c.json({ error: "That is today's allowance used up" }, 429);
    if (!key && freeUsed >= free.daily) return c.json({ error: "The free allowance is used up for today" }, 429);
    const taken = day, bump = (n: number) => {
      if (day !== taken) return;
      const left = (used.get(who) ?? 0) + n;
      if (left > 0) used.set(who, left); else used.delete(who);
      if (key) keyedUsed += n; else freeUsed += n;
    };
    bump(1);
    inFlight++;
    try {
      let audio;
      try { audio = readWav(await readCapped(c.req.raw)); }
      catch (e) {
        bump(-1);
        if (e instanceof BodyError) return c.json({ error: e.message }, e.status);
        return c.json({ error: e instanceof WavError ? e.message : "Could not read the audio" }, 400);
      }
      const limit = key ? MAX_SECONDS : free.maxSeconds;
      if (audio.seconds > limit) { bump(-1); return c.json({ error: `Clips are limited to ${limit} seconds` }, 413); }
      const seconds = Math.round(audio.seconds * 100) / 100;
      if (audio.seconds < MIN_SECONDS) { bump(-1); return c.json({ text: "", seconds, ms: 0 }); }
      const start = performance.now();
      try {
        const text = await transcribe(audio, !!key);
        return c.json({ text, seconds, ms: Math.round(performance.now() - start) });
      } catch {
        bump(-1);
        return c.json({ error: "Could not transcribe that" }, 500);
      }
    } finally {
      inFlight--;
    }
  });

  return app;
}
