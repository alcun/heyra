import { describe, expect, test } from "bun:test";
import { BodyError, createApp, parseKeys, readCapped } from "./app.ts";
import { oneAtATime } from "./stt.ts";
import { readWav, WavError } from "./wav.ts";

const KEY = "k".repeat(32);

// A WAV of `seconds` of silence; `size` overrides the data length field.
function wav(seconds: number, { rate = 16000, channels = 1, bits = 16, size }: { rate?: number; channels?: number; bits?: number; size?: number } = {}) {
  const frames = Math.round(seconds * rate), data = frames * channels * 2;
  const b = new DataView(new ArrayBuffer(44 + data)), s = (at: number, t: string) => [...t].forEach((ch, i) => b.setUint8(at + i, ch.charCodeAt(0)));
  s(0, "RIFF"); b.setUint32(4, 36 + data, true); s(8, "WAVE");
  s(12, "fmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, channels, true);
  b.setUint32(24, rate, true); b.setUint32(28, rate * channels * 2, true); b.setUint16(32, channels * 2, true); b.setUint16(34, bits, true);
  s(36, "data"); b.setUint32(40, size ?? data, true);
  for (let i = 0; i < frames * channels; i++) b.setInt16(44 + i * 2, i % channels ? -16384 : 16384, true);
  return new Uint8Array(b.buffer);
}

type Setup = { keyLimit?: number; perVisitor?: number; daily?: number; transcribe?: (a: any, first?: boolean) => Promise<string> };
function setup({ keyLimit = 3, perVisitor = 2, daily = 3, transcribe = async () => "a cat in a hat" }: Setup = {}) {
  let day = "2026-09-28";
  const app = createApp({ transcribe, keys: [KEY], keyLimit, free: { perVisitor, daily, maxSeconds: 15 }, today: () => day });
  const post = (body: Uint8Array, headers: Record<string, string> = {}) => app.request("/v1/transcribe", { method: "POST", body, headers });
  const keyed = (body: Uint8Array) => post(body, { authorization: `Bearer ${KEY}` });
  const from = (ip: string) => ({ "x-forwarded-for": `9.9.9.9, ${ip}` });
  return { app, post, keyed, from, nextDay: () => { day = "2026-09-29"; } };
}
const held = () => { let release!: () => void; const gate = new Promise<void>((r) => (release = r)); return { gate, release }; };

describe("readWav", () => {
  test("reads rate, length and samples", () => {
    const a = readWav(wav(1));
    expect(a.rate).toBe(16000);
    expect(a.seconds).toBe(1);
    expect(a.samples[0]).toBe(0.5);
  });
  test("averages stereo to mono", () => {
    const a = readWav(wav(0.5, { channels: 2, rate: 44100 }));
    expect(a.samples[0]).toBe(0);
    expect(a.seconds).toBeCloseTo(0.5, 3);
  });
  test("reads to the end when a streaming writer left the size unset", () => {
    expect(readWav(wav(1, { size: 0 })).seconds).toBe(1);
    expect(readWav(wav(1, { size: 0xffffffff })).seconds).toBe(1);
  });
  test("refuses what it cannot read", () => {
    expect(() => readWav(new TextEncoder().encode("not audio"))).toThrow(WavError);
    expect(() => readWav(wav(1, { bits: 8 }))).toThrow("16-bit PCM");
    expect(() => readWav(wav(0.1, { rate: 96000 }))).toThrow("8 and 48 kHz");
  });
});

describe("parseKeys", () => {
  test("reads keys", () => expect(parseKeys(` ${KEY} , ${"z".repeat(30)} `)).toHaveLength(2));
  test("unset means none", () => expect(parseKeys(undefined)).toEqual([]));
  test("refuses short keys, repeats and a setting with no keys", () => {
    expect(() => parseKeys("short")).toThrow("24");
    expect(() => parseKeys(`${KEY},${KEY}`)).toThrow("twice");
    expect(() => parseKeys(" , ,")).toThrow("no keys");
  });
});

describe("with a key", () => {
  test("returns the words", async () => expect(await (await setup().keyed(wav(2))).json()).toMatchObject({ text: "a cat in a hat", seconds: 2 }));
  test("a wrong key is refused, not treated as keyless", async () => expect((await setup().post(wav(1), { authorization: "Bearer nope" })).status).toBe(401));
  test("allows up to 30 seconds", async () => {
    expect((await setup().keyed(wav(29))).status).toBe(200);
    expect((await setup().keyed(wav(31))).status).toBe(413);
  });
  test("has its own allowance, which resets the next UTC day", async () => {
    const s = setup({ keyLimit: 1 });
    expect((await s.keyed(wav(1))).status).toBe(200);
    expect((await s.keyed(wav(1))).status).toBe(429);
    expect((await s.post(wav(1), s.from("1.1.1.1"))).status).toBe(200);
    s.nextDay();
    expect((await s.keyed(wav(1))).status).toBe(200);
  });
});

describe("without a key: the free allowance", () => {
  test("anyone may use it, per visitor", async () => {
    const s = setup({ perVisitor: 1, daily: 10 });
    expect((await s.post(wav(1), s.from("1.1.1.1"))).status).toBe(200);
    expect((await s.post(wav(1), s.from("1.1.1.1"))).status).toBe(429);
    expect((await s.post(wav(1), s.from("2.2.2.2"))).status).toBe(200);
  });
  test("within a ceiling for everyone together", async () => {
    const s = setup({ perVisitor: 5, daily: 2 });
    for (const ip of ["1.1.1.1", "2.2.2.2"]) expect((await s.post(wav(1), s.from(ip))).status).toBe(200);
    expect((await s.post(wav(1), s.from("3.3.3.3"))).status).toBe(429);
  });
  test("clips up to 15 seconds", async () => expect((await setup().post(wav(16))).status).toBe(413));
  test("a ceiling of 0 means a key is needed", async () => {
    const r = await setup({ daily: 0 }).post(wav(1));
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ error: "A key is needed" });
  });
  test("health says whether there is a free allowance", async () => {
    expect(await (await setup().app.request("/healthz")).json()).toMatchObject({ free: true });
    expect(await (await setup({ daily: 0 }).app.request("/healthz")).json()).toMatchObject({ free: false });
  });
  test("health counts today's clips, free and keyed", async () => {
    const s = setup();
    await s.post(wav(1)); await s.keyed(wav(1)); await s.keyed(new Uint8Array(10));
    expect(await (await s.app.request("/healthz")).json()).toMatchObject({ today: { free: 1, keyed: 1 } });
  });
  test("any page may call, and refusals carry the header too", async () => {
    const r = await setup({ daily: 0 }).post(wav(1), { origin: "https://page.example" });
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("clips", () => {
  test("a blip is empty without transcribing", async () => {
    let called = false;
    const r = await setup({ transcribe: async () => { called = true; return "x"; } }).keyed(wav(0.1));
    expect(await r.json()).toMatchObject({ text: "" }); expect(called).toBe(false);
  });
  test("refuses bad audio and bodies over the byte limit", async () => {
    expect((await setup().keyed(new Uint8Array(100))).status).toBe(400);
    expect((await setup().keyed(new Uint8Array(7 * 1024 * 1024))).status).toBe(413);
  });
  test("a failed or unusable clip does not use up the allowance", async () => {
    let fail = true;
    const s = setup({ keyLimit: 1, transcribe: async () => { if (fail) throw Error("x"); return "ok"; } });
    expect((await s.keyed(wav(1))).status).toBe(500);
    expect((await s.keyed(new Uint8Array(10))).status).toBe(400);
    fail = false;
    expect((await s.keyed(wav(1))).status).toBe(200);
  });
});

describe("under load", () => {
  test("twelve at once against an allowance of one: one gets through", async () => {
    const { gate, release } = held();
    const s = setup({ keyLimit: 1, transcribe: async () => { await gate; return "hi"; } });
    const all = Array.from({ length: 12 }, () => s.keyed(wav(1)));
    release();
    const codes = (await Promise.all(all)).map((r) => r.status);
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 429)).toHaveLength(11);
  });
  test("strangers take at most six places; two stay for keys", async () => {
    const { gate, release } = held();
    const s = setup({ perVisitor: 100, daily: 100, keyLimit: 100, transcribe: async () => { await gate; return "hi"; } });
    const strangers = Array.from({ length: 10 }, (_, i) => s.post(wav(1), s.from(`1.1.1.${i}`)));
    await Bun.sleep(10);
    const mine = [s.keyed(wav(1)), s.keyed(wav(1))];
    await Bun.sleep(10); release();
    const codes = (await Promise.all(strangers)).map((r) => r.status);
    expect(codes.filter((c) => c === 200)).toHaveLength(6);
    expect(codes.filter((c) => c === 503)).toHaveLength(4);
    expect((await Promise.all(mine)).map((r) => r.status)).toEqual([200, 200]);
  });
});

describe("the queue", () => {
  test("one at a time, and a key goes to the front", async () => {
    const order: string[] = [];
    const { gate, release } = held();
    const q = oneAtATime(async (a: any) => { if (a === "first") await gate; order.push(a); return a; });
    const runs = [q("first" as any), q("stranger1" as any), q("stranger2" as any), q("mine" as any, true)];
    await Bun.sleep(5); release();
    await Promise.all(runs);
    expect(order).toEqual(["first", "mine", "stranger1", "stranger2"]);
  });
  test("a job that throws before it starts is still answered", async () => {
    const q = oneAtATime((() => { throw Error("sync"); }) as any);
    await expect(q("x" as any)).rejects.toThrow("sync");
  });
  test("a failure does not stop the queue", async () => {
    const q = oneAtATime(async (a: any) => { if (a === "bad") throw Error("x"); return a; });
    await expect(q("bad" as any)).rejects.toThrow();
    expect(await q("good" as any)).toBe("good");
  });
});

describe("reading uploads", () => {
  const streamed = (chunks: number[], stallAfter = Infinity) => new Request("http://x/", {
    method: "POST", duplex: "half",
    body: new ReadableStream({
      async pull(ctl) {
        const n = chunks.shift();
        if (n === undefined) return ctl.close();
        if (chunks.length < stallAfter) ctl.enqueue(new Uint8Array(n)); else await new Promise(() => {});
      },
    }),
  } as RequestInit);
  test("a streamed body over the cap stops at the cap", async () => {
    const e = await readCapped(streamed([600, 600]), 1000).catch((x) => x);
    expect(e).toBeInstanceOf(BodyError); expect(e.status).toBe(413);
  });
  test("a stalled upload is given up on", async () => {
    const e = await readCapped(streamed([10, 10, 10], 1), 1000, 50).catch((x) => x);
    expect(e).toBeInstanceOf(BodyError); expect(e.status).toBe(408);
  });
  test("a declared size over the cap is refused without reading", async () => {
    const req = new Request("http://x/", { method: "POST", body: "x", headers: { "content-length": "999999999" } });
    expect((await readCapped(req, 1000).catch((x) => x)).status).toBe(413);
  });
  test("a normal body arrives whole", async () => expect((await readCapped(streamed([3, 4]), 1000)).byteLength).toBe(7));
  test("an unknown key is refused before the body is read", async () => {
    const app = createApp({ transcribe: async () => "hi", keys: [KEY], keyLimit: 5, free: { perVisitor: 5, daily: 5, maxSeconds: 15 } });
    const req = streamed([10], 0);
    const r = await Promise.race([app.request("/v1/transcribe", { method: "POST", body: req.body, headers: { authorization: "Bearer nope" }, duplex: "half" } as RequestInit), Bun.sleep(500).then(() => null)]);
    expect(r?.status).toBe(401);
  });
});
