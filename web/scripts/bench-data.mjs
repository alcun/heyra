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
  "bark-3.0-clean": { name: "Bark 3.0 Clean", langs: "English", note: "Leaves out “um” and “uh”", heyra: true },
  "fluid-speech-mini": { name: "Fluid Speech Mini", langs: "English", note: "Every word", heyra: true },
  "parakeet-v3": { name: "Parakeet v3", langs: "25 languages", note: "European languages", heyra: true },
  "parakeet-v2": { name: "Parakeet v2", langs: "English", note: "NVIDIA, English only" },
  "parakeet-110m": { name: "Parakeet 110M", langs: "English", note: "A fifth of the size" },
  "moonshine-base": { name: "Moonshine Base", langs: "English", note: "Small and quick" },
  "canary-180m": { name: "Canary 180M", langs: "4 languages", note: "English, German, Spanish, French" },
  "whisper-distil-v3.5": { name: "Whisper Distil v3.5", langs: "English", note: "OpenAI Whisper, distilled" },
  "whisper-turbo": { name: "Whisper Turbo", langs: "99 languages", note: "OpenAI Whisper" },
  "qwen3-asr-0.6b": { name: "Qwen3-ASR 0.6B", langs: "30 languages", note: "Alibaba" },
  "cohere-transcribe": { name: "Cohere Transcribe", langs: "14 languages", note: "Cohere" },
};

const SETS = [
  { id: "disfluency-meant", name: "Off the cuff, meant", source: "DisfluencySpeech, cleaned up" },
  { id: "disfluency", name: "Off the cuff, word for word", source: "DisfluencySpeech" },
  { id: "ami", name: "Meetings", source: "AMI" },
  { id: "earnings22", name: "Earnings calls", source: "Earnings-22" },
  { id: "gigaspeech", name: "Podcasts", source: "GigaSpeech" },
  { id: "spgispeech", name: "Finance calls", source: "SPGISpeech" },
  { id: "voxpopuli", name: "Parliament", source: "VoxPopuli" },
  { id: "librispeech-clean", name: "Audiobooks", source: "LibriSpeech clean" },
  { id: "librispeech-other", name: "Audiobooks, hard", source: "LibriSpeech other" },
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
  JSON.stringify({ date: today, clips: exp.clips_scored, engine: old.engine, models, sets: SETS, listen: clips, duos: old.duos, wait: old.wait }, null, 2) + "\n",
);
console.log(`${models.length} models, ${clips.length} clips to listen to`);
