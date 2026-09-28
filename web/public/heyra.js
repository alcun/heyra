// Hold the stone, speak, let go: the recording is resampled to 16 kHz mono,
// wrapped as a WAV and sent to Heyra's API with this browser's saved key, on this same origin.
// While you hold, the ring of notches is a live level meter: each notch is a
// band of the voice, mirrored left and right, low notes at the top. It settles
// when you let go, and draws nothing at all when idle.

// Just under the server's limits: 15 s free, 30 s with a key.
const limit = () => (key ? 29.5 : 14.5);
const NOTCHES = 90, BANDS = NOTCHES / 2, RATE = 16000, MIN = 0.4;

const $ = (s) => document.querySelector(s);
const stone = $("#stone"), ring = $("#ring"), status = $("#status"), heard = $("#heard");
const keyForm = $("#key"), keyInput = keyForm.querySelector("input"), forget = $("#forget");

const store = {
  get: () => { try { return localStorage.getItem("heyra-key") || ""; } catch { return ""; } },
  set: (v) => { try { v ? localStorage.setItem("heyra-key", v) : localStorage.removeItem("heyra-key"); } catch {} },
};
// A key is optional: the free allowance needs none. The key box appears only
// when one is needed, and a saved key is used and can be forgotten.
let key = store.get(), needsKey = false;

const say = (t) => { status.textContent = t; };
const IDLE = "Hold and speak.";

function showKey(message) {
  keyForm.hidden = false; stone.disabled = true; forget.hidden = true;
  say(message || "Paste your key to start. It stays in this browser.");
}
function ready() {
  // One link: "Have a key?" without one, "Forget key" with one.
  keyForm.hidden = true; stone.disabled = false; forget.hidden = false;
  forget.textContent = key ? "Forget key" : "Have a key?"; say(IDLE);
}
keyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  key = keyInput.value.trim(); keyInput.value = "";
  if (key) { store.set(key); ready(); stone.focus(); }
  else if (!needsKey) ready();
});
forget.addEventListener("click", () => {
  if (!key) return showKey("Paste your key for longer clips and no waiting. Leave it empty to go back.");
  key = ""; store.set("");
  if (needsKey) showKey("Key forgotten."); else { ready(); say("Key forgotten. The free allowance still works."); }
});

// ---- the ring ----------------------------------------------------------
const SVG = "http://www.w3.org/2000/svg", C = 160, R = 150;
const notches = Array.from({ length: NOTCHES }, (_, i) => {
  const a = (i / NOTCHES) * Math.PI * 2 - Math.PI / 2, l = document.createElementNS(SVG, "line");
  // Mirrored: the notch on the left shares its band with the one on the right.
  l.dataset.a = String(a); l.dataset.band = String(i < BANDS ? i : NOTCHES - 1 - i); ring.append(l); return l;
});
function draw(levels) {
  for (const l of notches) {
    const a = Number(l.dataset.a), v = levels[Number(l.dataset.band)] || 0, inner = R - 8 - v * 34;
    l.setAttribute("x1", String(C + Math.cos(a) * R)); l.setAttribute("y1", String(C + Math.sin(a) * R));
    l.setAttribute("x2", String(C + Math.cos(a) * inner)); l.setAttribute("y2", String(C + Math.sin(a) * inner));
    l.classList.toggle("cut", v > 0.04);
  }
}
const rest = new Float32Array(BANDS);
draw(rest);

// Log-spaced bands from 90 Hz to 5 kHz, where a voice lives. Fast to rise,
// slower to fall, so it reads as a voice rather than flicker.
let analyser = null, bins = null, edges = [], levels = new Float32Array(BANDS), frame = 0;
function meter() {
  if (analyser && stream) {
    analyser.getByteFrequencyData(bins);
    for (let b = 0; b < BANDS; b++) {
      let peak = 0;
      for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) peak = Math.max(peak, bins[k]);
      const target = Math.pow(peak / 255, 1.8);
      levels[b] += (target - levels[b]) * (target > levels[b] ? 0.55 : 0.12);
    }
  } else {
    for (let b = 0; b < BANDS; b++) levels[b] *= 0.82;
  }
  draw(levels);
  frame = stream || levels.some((v) => v > 0.01) ? requestAnimationFrame(meter) : 0;
  if (!frame) draw(rest);
}

// ---- recording -----------------------------------------------------------
let ctx = null, stream = null, node = null, source = null, chunks = [], started = 0, down = false, sending = false, loaded = false, left = 0, starting = false;

async function begin() {
  if (down || starting || sending || (needsKey && !key)) return;
  down = true; starting = true; stone.classList.add("held"); say("Opening the microphone");
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    if (!loaded) { await ctx.audioWorklet.addModule("/capture.js"); loaded = true; }
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    starting = false; down = false; stone.classList.remove("held");
    return say(e?.name === "NotAllowedError"
      ? "Heyra needs the microphone. Allow it in this site's settings, then hold again."
      : "The microphone would not open. Check no other app is using it.");
  }
  // Let go while the permission prompt was up: the microphone is on now, so say so.
  starting = false;
  if (!down) { stop(); return say("Microphone on. Now hold and speak."); }
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
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.5;
    analyser.minDecibels = -85; analyser.maxDecibels = -25;
    bins = new Uint8Array(analyser.frequencyBinCount);
    const hz = ctx.sampleRate / analyser.fftSize;
    edges = Array.from({ length: BANDS + 1 }, (_, b) => Math.round((90 * Math.pow(5000 / 90, b / BANDS)) / hz));
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
  sending = true; stone.classList.add("thinking"); say("Writing it down");
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
    sending = false; stone.classList.remove("thinking");
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
  meta.textContent = `${seconds.toFixed(1)} s, written in ${(ms / 1000).toFixed(2)} s`;
  li.append(q, meta); heard.prepend(li);
  while (heard.children.length > 5) heard.lastChild.remove();
}

// ---- the stone, by pointer and by keyboard --------------------------------
stone.addEventListener("pointerdown", (e) => { e.preventDefault(); stone.setPointerCapture?.(e.pointerId); begin(); });
stone.addEventListener("pointerup", end);
stone.addEventListener("pointercancel", end);
stone.addEventListener("contextmenu", (e) => e.preventDefault());
stone.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); begin(); } });
stone.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); end(); } });
stone.addEventListener("blur", end);

// The code example names whichever host is serving this page.
const example = $("#curl");
if (example) example.textContent = example.textContent.replace("http://localhost:3000", location.origin);

if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) { stone.disabled = true; say("This browser cannot record audio here."); }
// A server with no free allowance asks for a key up front.
else fetch("/healthz").then((r) => r.json()).catch(() => ({})).then((h) => {
  needsKey = h.free === false;
  if (!needsKey || key) ready(); else showKey();
});
