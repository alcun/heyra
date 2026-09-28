// Reads a WAV file into mono float samples, which is all the recogniser wants.
// 16-bit PCM only, any sample rate, mono or stereo (averaged). Tolerates the
// zero or 0xFFFFFFFF data size that streaming writers leave when they cannot
// seek back, by reading to the end of the body.

export type Audio = { rate: number; samples: Float32Array; seconds: number };

export class WavError extends Error {}

export function readWav(buf: Uint8Array): Audio {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (at: number) => String.fromCharCode(...buf.subarray(at, at + 4));
  if (buf.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new WavError("Send a WAV file");

  let rate = 0, channels = 0, bits = 0;
  for (let at = 12; at + 8 <= buf.byteLength;) {
    const id = tag(at), size = v.getUint32(at + 4, true), body = at + 8;
    if (id === "fmt ") {
      if (size < 16) throw new WavError("The WAV format block is too short");
      let format = v.getUint16(body, true);
      // WAVE_FORMAT_EXTENSIBLE carries the real format in its sub-format GUID.
      if (format === 0xfffe && size >= 26) format = v.getUint16(body + 24, true);
      channels = v.getUint16(body + 2, true); rate = v.getUint32(body + 4, true); bits = v.getUint16(body + 14, true);
      if (format !== 1 || bits !== 16) throw new WavError("Send 16-bit PCM WAV");
      if (channels < 1 || channels > 2) throw new WavError("Send mono or stereo audio");
      if (rate < 8000 || rate > 48000) throw new WavError("Send audio sampled between 8 and 48 kHz");
    } else if (id === "data") {
      if (!rate) throw new WavError("The WAV format block must come before the audio");
      const end = size === 0 || size === 0xffffffff ? buf.byteLength : Math.min(buf.byteLength, body + size);
      const frames = Math.floor((end - body) / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += v.getInt16(body + (i * channels + c) * 2, true);
        samples[i] = sum / channels / 32768;
      }
      return { rate, samples, seconds: frames / rate };
    }
    at = body + size + (size & 1);
  }
  throw new WavError("The WAV file has no audio");
}
