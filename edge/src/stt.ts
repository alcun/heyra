// The recogniser: Parakeet TDT 0.6B v3 (int8) through sherpa-onnx, loaded once
// and kept. It covers English and 24 other European languages and finds the
// language itself. Clips are transcribed one at a time, so a burst queues
// instead of taking every core, and callers with a key go to the front.

import type { Audio } from "./wav.ts";

export type Transcribe = (audio: Audio, first?: boolean) => Promise<string>;

// One at a time; a job marked first runs before any job that is not.
export function oneAtATime(run: (audio: Audio) => Promise<string>): Transcribe {
  const waiting: { first: boolean; go: () => Promise<void> }[] = [];
  let busy = false;
  const next = async () => {
    if (busy || !waiting.length) return;
    const i = waiting.findIndex((w) => w.first);
    const [job] = waiting.splice(i >= 0 ? i : 0, 1);
    busy = true;
    try { await job!.go(); } finally { busy = false; next(); }
  };
  return (audio, first = false) => new Promise<string>((resolve, reject) => {
    waiting.push({ first, go: () => Promise.resolve().then(() => run(audio)).then(resolve, reject) });
    next();
  });
}

export async function loadRecogniser(dir: string, threads: number): Promise<Transcribe> {
  const { OfflineRecognizer } = require("sherpa-onnx-node");
  const recogniser = await OfflineRecognizer.createAsync({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: `${dir}/encoder.int8.onnx`, decoder: `${dir}/decoder.int8.onnx`, joiner: `${dir}/joiner.int8.onnx` },
      tokens: `${dir}/tokens.txt`, numThreads: threads, modelType: "nemo_transducer",
    },
  });
  return oneAtATime(async (audio) => {
    const stream = recogniser.createStream();
    // Other sample rates are resampled inside the recogniser.
    stream.acceptWaveform({ sampleRate: audio.rate, samples: audio.samples });
    const result = await recogniser.decodeAsync(stream);
    return String(result.text || "").trim();
  });
}
