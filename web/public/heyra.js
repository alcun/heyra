// Hold the orb (or the space bar), speak, let go: the recording is resampled to
// 16 kHz mono, wrapped as a WAV and sent to Heyra's API with this browser's saved
// key, on this same origin. While you hold, the orb follows your voice; while
// the words are written it turns gold.

import { orb as makeOrb } from "/orb.js";

// Just under the server's limits: 15 s free, 30 s with a key.
const limit = () => (key ? 29.5 : 14.5);
const RATE = 16000, MIN = 0.4;

const $ = (s) => document.querySelector(s);
const stone = $("#stone"), status = $("#status"), heard = $("#heard");
const orb = makeOrb($("#orb"));
// The light leans toward the pointer while it's over the hero.
const hero = $(".hero");
hero?.addEventListener("pointermove", (e) => {
  const r = $("#orb").getBoundingClientRect();
  const x = (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2);
  const y = (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2);
  orb.look(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
});
hero?.addEventListener("pointerleave", () => orb.look(0, 0));
stone.addEventListener("pointerenter", () => orb.hover(true));
stone.addEventListener("pointerleave", () => orb.hover(false));
const keyForm = $("#key"), keyInput = keyForm.querySelector("input"), forget = $("#forget");

const store = {
  get: () => { try { return localStorage.getItem("heyra-key") || ""; } catch { return ""; } },
  set: (v) => { try { v ? localStorage.setItem("heyra-key", v) : localStorage.removeItem("heyra-key"); } catch {} },
};
// A key is optional: the free allowance needs none. The key box appears only
// when one is needed, and a saved key is used and can be forgotten.
let key = store.get(), needsKey = false;

// Status text; "space" in the prompt is drawn as a key cap.
const say = (t) => {
  status.textContent = "";
  const parts = t.split(/(space bar)/);
  for (const part of parts) {
    if (part === "space bar") { const k = document.createElement("kbd"); k.textContent = "space"; status.append(k); }
    else status.append(part);
  }
};
const IDLE = matchMedia("(pointer: coarse)").matches ? "Hold the orb to speak." : "Hold the orb or space bar to speak.";

function showKey(message) {
  keyForm.hidden = false; forget.hidden = true;
  if (needsKey && !key) stone.disabled = true;
  say(message || "Paste your key to start. It stays in this browser.");
}
function ready() {
  // In the developer section: "Use a key in the demo" without one, "Forget key" with one.
  keyForm.hidden = true; stone.disabled = false; forget.hidden = false;
  forget.textContent = key ? "Forget key" : "Use a key in the demo"; say(IDLE);
}
keyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  key = keyInput.value.trim(); keyInput.value = "";
  if (key) { store.set(key); ready(); stone.focus(); }
  else if (!needsKey) ready();
});
forget.addEventListener("click", () => {
  if (!key) { showKey("Paste your key for longer clips and no waiting. Leave it empty to go back."); return keyInput.focus(); }
  key = ""; store.set("");
  if (needsKey) showKey("Key forgotten."); else { ready(); say("Key forgotten. The free allowance still works."); }
});

// ---- the level -------------------------------------------------------------
// Loudness of the voice, fast to rise and slow to fall, handed to the orb.
let analyser = null, samples = null, frame = 0;
function meter() {
  if (analyser && stream) {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const x of samples) sum += x * x;
    orb.level(Math.min(1, Math.sqrt(sum / samples.length) * 9));
    frame = requestAnimationFrame(meter);
  } else {
    orb.level(0);
    frame = 0;
  }
}

// ---- recording -----------------------------------------------------------
let ctx = null, stream = null, node = null, source = null, chunks = [], started = 0, down = false, sending = false, loaded = false, left = 0, starting = false;

async function begin() {
  if (down || starting || sending || (needsKey && !key)) return;
  down = true; starting = true; stone.classList.add("held"); say("Opening the microphone");
  try {
    // Audio may only start on a user activation, and on a touch screen pressing
    // down is not one, only letting go is. So never wait on resume() here: a
    // phone's first press would hang before the microphone prompt.
    ctx ??= new AudioContext();
    ctx.resume().catch(() => {});
    if (!loaded) { await ctx.audioWorklet.addModule("/capture.js"); loaded = true; }
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 250))]);
  } catch (e) {
    starting = false; down = false; stone.classList.remove("held");
    return say(e?.name === "NotAllowedError"
      ? "Heyra needs the microphone. Allow it in this site's settings, then hold again."
      : "The microphone would not open. Check no other app is using it.");
  }
  // Let go while the permission prompt was up: the microphone is on now, so say so.
  starting = false;
  if (!down) { stop(); return say("Microphone on. Now hold and speak."); }
  // A first press on a phone: the microphone is open but audio can't run until
  // the finger lifts, which unlocks it below. The next hold records.
  if (ctx.state !== "running") { stop(); down = false; stone.classList.remove("held"); return say("Microphone on. Let go, then hold to speak."); }
  chunks = []; left = 0;
  source = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, "capture");
  node.port.onmessage = ({ data }) => {
    chunks.push(data);
    const t = (performance.now() - started) / 1000, remaining = Math.ceil(limit() - t);
    if (remaining <= 5 && remaining !== left) { left = remaining; say(remaining > 1 ? `${remaining} seconds left` : "1 second left"); }
    if (t >= limit()) end();
  };
  if (!analyser) {
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    samples = new Float32Array(analyser.fftSize);
  }
  source.connect(node); source.connect(analyser);
  started = performance.now();
  stone.classList.add("listening"); say("Listening");
  if (!frame) frame = requestAnimationFrame(meter);
}

function stop() {
  try { source?.disconnect(); node?.disconnect(); analyser?.disconnect(); if (node) node.port.onmessage = null; } catch {}
  stream?.getTracks().forEach((t) => t.stop()); stream = null; source = null;
}

async function end() {
  if (!down) return;
  down = false; stone.classList.remove("held", "listening");
  if (!stream) return;
  stop();
  const seconds = (performance.now() - started) / 1000;
  if (seconds < MIN) return say("Hold a little longer while you speak.");
  sending = true; stone.classList.add("thinking"); orb.writing(true); say("Writing it down");
  try {
    const wav = await encode(chunks, ctx.sampleRate);
    const r = await fetch("/v1/transcribe", { method: "POST", headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), "content-type": "audio/wav" }, body: wav });
    const body = await r.json().catch(() => ({}));
    if (r.status === 401) {
      if (!key) { needsKey = true; return showKey("This server needs a key. Paste yours to start."); }
      key = ""; store.set(""); return showKey("That key was not recognised. Paste it again.");
    }
    if (r.status === 429 && !key) return showKey("Today's free clips are used up. Paste a key to carry on, or come back after midnight UTC.");
    if (!r.ok) return say(r.status === 429 ? "This key is used up for today. It resets at midnight UTC." : body.error || "That did not work. Try again.");
    if (!body.text) return say("Nothing heard. Try a little closer.");
    record(body);
    say(IDLE);
  } catch {
    say("Could not reach Heyra. Check the connection.");
  } finally {
    sending = false; stone.classList.remove("thinking"); orb.writing(false);
  }
}

// Resampled by the browser, which filters properly, then written as 16-bit PCM.
async function encode(parts, rate) {
  const length = parts.reduce((n, p) => n + p.length, 0), input = new Float32Array(length);
  let at = 0; for (const p of parts) { input.set(p, at); at += p.length; }
  const off = new OfflineAudioContext(1, Math.ceil((length * RATE) / rate), RATE);
  const buf = off.createBuffer(1, length, rate); buf.copyToChannel(input, 0);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const v = new DataView(new ArrayBuffer(44 + pcm.length * 2)), s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); s(8, "WAVE"); s(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([v.buffer], { type: "audio/wav" });
}

function record({ text, seconds, ms }) {
  const li = document.createElement("li"), q = document.createElement("q"), meta = document.createElement("span");
  q.textContent = text;
  meta.textContent = `${seconds.toFixed(1)} s of speech · written in ${(ms / 1000).toFixed(2)} s`;
  li.append(q, meta); heard.prepend(li);
  // Tap what it heard to copy it.
  q.tabIndex = 0; q.title = "Copy";
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); meta.textContent = "Copied"; }
    catch { getSelection()?.selectAllChildren(q); }
  };
  q.addEventListener("click", copy);
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") copy(); });
  while (heard.children.length > 5) heard.lastChild.remove();
}

// ---- the orb, by pointer and by keyboard -----------------------------------
// Lifting a finger is a user activation, so it can start audio a press could not.
const unlock = () => { if (ctx && ctx.state !== "running") ctx.resume().catch(() => {}); };
addEventListener("pointerup", unlock, true); addEventListener("touchend", unlock, true);
stone.addEventListener("pointerdown", (e) => { e.preventDefault(); stone.setPointerCapture?.(e.pointerId); begin(); });
stone.addEventListener("pointerup", end);
stone.addEventListener("pointercancel", end);
stone.addEventListener("contextmenu", (e) => e.preventDefault());
stone.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); begin(); } });
stone.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); end(); } });
stone.addEventListener("blur", end);
// The space bar too, but only while the orb is on screen and nothing has focus,
// so space still scrolls the page and presses buttons and FAQ items.
let orbInView = false;
new IntersectionObserver(([entry]) => { orbInView = entry.isIntersecting; }).observe(stone);
const loose = (e) => orbInView && (e.target === document.body || e.target === document.documentElement);
addEventListener("keydown", (e) => {
  if (e.key !== " " || !loose(e) || stone.disabled) return;
  // Swallow every space, repeats included, so holding it never scrolls the page.
  e.preventDefault();
  if (!e.repeat) begin();
});
addEventListener("keyup", (e) => { if (e.key === " " && loose(e)) { e.preventDefault(); end(); } });

// The code example names whichever host is serving this page.
const example = $("#curl");
if (example) example.textContent = example.textContent.replace("http://localhost:3000", location.origin);

if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) { stone.disabled = true; say("This browser cannot record audio here."); }
// A server with no free allowance asks for a key up front. The light by the
// prompt shows whether the demo server is up.
else fetch("/healthz").then((r) => r.json()).catch(() => ({})).then((h) => {
  document.body.dataset.demo = h.ok ? "up" : "down";
  needsKey = h.free === false;
  if (!needsKey || key) ready(); else showKey();
});
