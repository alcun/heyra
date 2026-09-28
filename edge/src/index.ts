import { createApp, MAX_BYTES, parseKeys } from "./app.ts";
import { loadRecogniser } from "./stt.ts";
import { withWeb } from "./web.ts";

// Settings are checked at startup: a typo stops the server rather than
// quietly becoming a default.
const env = process.env;
function whole(name: string, fallback: number, min = 0) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const n = raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`${name} must be a whole number of ${min} or more, not "${raw}"`);
  return n;
}

const keys = parseKeys(env.KEYS);
const free = { perVisitor: whole("FREE_PER_VISITOR", 100), daily: whole("FREE_DAILY", 1000), maxSeconds: 15 };
if (!keys.length && !free.daily) throw new Error("FREE_DAILY is 0 and there are no KEYS, so nobody could use it");

// Loaded before listening, so the health check only passes once it can hear.
const transcribe = await loadRecogniser(env.MODEL_DIR || "/models/parakeet", whole("THREADS", 4, 1));
const app = createApp({ transcribe, keys, keyLimit: whole("KEY_DAILY", 1000), free });

const port = whole("PORT", 3000, 1);
console.log(`heyra listening on ${port}: ${keys.length} key(s), free ${free.perVisitor} a visitor and ${free.daily} a day`);
export default { port, fetch: withWeb(app.fetch, env.HEYRA_WEB_ROOT), maxRequestBodySize: MAX_BYTES };
