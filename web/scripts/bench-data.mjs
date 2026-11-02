// Builds src/data/bench.json and the page's audio clips from a heyra-bench export.
//
//   node scripts/bench-data.mjs <export.json> <heyra-bench data dir>
//
// The export has the numbers; this adds what the page says about each model, and
// turns the chosen clips into small MP3s in public/bench/clips/.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [exportPath, dataDir] = process.argv.slice(2);
if (!exportPath || !dataDir) throw new Error("usage: bench-data.mjs <export.json> <data dir>");
const exp = JSON.parse(readFileSync(exportPath, "utf8"));
const old = JSON.parse(readFileSync("src/data/bench.json", "utf8"));

// What the page says about each model. Anything not listed here stays off the page.
const META = {
  "bark-3.0-clean": { name: "Bark 3.0 Clean", by: "Underdog", langs: "English", note: "Leaves out “um” and “uh”", license: "CC BY 4.0", heyra: true },
  "fluid-speech-mini": { name: "Fluid Speech Mini", by: "FluidVoice", langs: "English", note: "Every word", license: "CC BY 4.0", heyra: true },
  "parakeet-v2": { name: "Parakeet v2", by: "NVIDIA", langs: "English", note: "Parakeet TDT 0.6B v2", license: "CC BY 4.0" },
  "parakeet-v3": { name: "Parakeet v3", by: "NVIDIA", langs: "25 languages", note: "Parakeet TDT 0.6B v3", license: "CC BY 4.0", heyra: true },
  "parakeet-unified": { name: "Parakeet Unified", by: "NVIDIA", langs: "English", note: "2026, offline build", license: "NVIDIA Open Model" },
  "parakeet-110m": { name: "Parakeet 110M", by: "NVIDIA", langs: "English", note: "A fifth of the size", license: "CC BY 4.0" },
  "nemotron-en": { name: "Nemotron Streaming", by: "NVIDIA", langs: "English", note: "Streaming, 560 ms", license: "NVIDIA Open Model" },
  "nemotron-3.5": { name: "Nemotron 3.5", by: "NVIDIA", langs: "40 languages", note: "Streaming, 560 ms", license: "NVIDIA Open Model" },
  "canary-180m": { name: "Canary 180M", by: "NVIDIA", langs: "4 languages", note: "English, German, Spanish, French", license: "CC BY 4.0" },
  "moonshine-base": { name: "Moonshine Base", by: "Useful Sensors", langs: "English", note: "Small and quick", license: "MIT" },
  "whisper-distil-v3.5": { name: "Whisper Distil v3.5", by: "OpenAI, distilled", langs: "English", note: "Distil-Whisper large v3.5", license: "MIT" },
  "whisper-turbo": { name: "Whisper Turbo", by: "OpenAI", langs: "99 languages", note: "Whisper large v3 turbo", license: "MIT" },
  "qwen3-asr-0.6b": { name: "Qwen3-ASR 0.6B", by: "Alibaba", langs: "30 languages", note: "Qwen3-ASR", license: "Apache 2.0" },
  "cohere-transcribe": { name: "Cohere Transcribe", by: "Cohere", langs: "14 languages", note: "2B, March 2026", license: "Apache 2.0" },
};

const SETS = [
  { id: "ami", name: "Meetings", source: "AMI" },
  { id: "earnings22", name: "Earnings calls", source: "Earnings-22" },
  { id: "gigaspeech", name: "Podcasts", source: "GigaSpeech" },
  { id: "spgispeech", name: "Finance calls", source: "SPGISpeech" },
  { id: "voxpopuli", name: "Parliament", source: "VoxPopuli" },
  { id: "librispeech-clean", name: "Audiobooks", source: "LibriSpeech clean" },
  { id: "librispeech-other", name: "Audiobooks, hard", source: "LibriSpeech other" },
  { id: "disfluency-meant", name: "Off the cuff, meant", source: "DisfluencySpeech, cleaned up" },
  { id: "disfluency", name: "Off the cuff, word for word", source: "DisfluencySpeech" },
];

const round = (v) => (v == null ? null : Math.round(v * 100) / 100);
const models = exp.models
  .filter((m) => META[m.id])
  .map((m) => ({
    id: m.id,
    ...META[m.id],
    heyra: !!META[m.id].heyra,
    mb: Math.round(m.mb),
    speed: Math.round(m.speed),
    average: round(m.average),
    meant: round(m.meant),
    v: Object.fromEntries(Object.entries(m.sets).map(([k, v]) => [k, round(v)])),
  }));
const shown = new Set(models.map((m) => m.id));

// One clip per kind of speech, the one where the models differ most.
const KIND = { "librispeech-clean": "Audiobook", "librispeech-other": "Audiobook, hard", ami: "Meeting", earnings22: "Earnings call", voxpopuli: "Parliament" };
const out = "public/bench/clips";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const seen = new Set();
const clips = [];
for (const c of exp.clips) {
  if (seen.has(c.set) || !KIND[c.set]) continue;
  seen.add(c.set);
  const audio = `${c.set}-${c.file.replace(/\.wav$/, "")}.mp3`;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(dataDir, c.set, c.file), "-ac", "1", "-ar", "22050", "-b:a", "48k", join(out, audio)]);
  clips.push({
    kind: KIND[c.set],
    source: SETS.find((s) => s.id === c.set)?.source ?? c.set,
    secs: Math.round(c.secs * 10) / 10,
    audio: `/bench/clips/${audio}`,
    said: c.said,
    takes: c.takes.filter(([id]) => shown.has(id)).map(([id, wrong, ops]) => ({ id, wrong, ops: ops.map((o) => Object.entries(o)[0]) })),
  });
}

const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
writeFileSync(
  "src/data/bench.json",
  JSON.stringify({ date: today, clips: exp.clips_scored, engine: old.engine, models, sets: SETS, listen: clips, wait: old.wait }, null, 2) + "\n",
);
console.log(`${models.length} models, ${clips.length} clips to listen to`);
