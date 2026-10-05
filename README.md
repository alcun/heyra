# Heyra

Self-hosted speech to text. Send a short WAV, get the words back. It runs on a
CPU, needs no GPU and no third-party API, and never keeps the audio. Heyra is
Old Norse for "to hear".

It runs NVIDIA's Parakeet TDT 0.6B v3 through sherpa-onnx: English and 24 other
European languages, found automatically, in about a quarter of a second for a
3 second clip on an ordinary cloud CPU. A small page lets you try it: hold a
button, speak, and read what it heard.

## Run it

With Docker:

```sh
docker build -t heyra .
docker run -p 127.0.0.1:3000:3000 heyra
```

Open http://localhost:3000 and hold the button. The build downloads the model
(about 640 MB) once, and the container needs about 1 GB of memory. For the API
alone, without the page, add `-e HEYRA_WEB_ROOT=`.

Without Docker, with [Bun](https://bun.sh):

```sh
mkdir -p models && curl -fsSL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2 | tar -xj -C models
(cd web && bun install && bun run build)
cd edge && bun install
MODEL_DIR=../models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8 HEYRA_WEB_ROOT=../web/dist bun run dev
```

## Who can use it

Anyone gets a **free allowance** with no key: 100 clips a day each, 1000 a day
for everyone together, 15 seconds a clip. **Keys** are optional and get more:
their own daily allowance, 30 second clips, the front of the queue, and two of
the eight places that the free allowance can never take.

```sh
docker run -p 3000:3000 -e KEYS="$(openssl rand -hex 16),$(openssl rand -hex 16)" heyra
```

Set `FREE_DAILY=0` to require a key. Allowances are counted in memory, so a
restart resets them, and each running copy has its own. Clips are transcribed one at a time, so
however busy it gets, it uses about one clip's worth of CPU at a time, and the
daily ceilings bound the total. Put it behind an HTTPS proxy that appends the
caller's address to `X-Forwarded-For`: browsers only allow the microphone over
HTTPS or on localhost, and the free allowance counts visitors by that address.

## API

```
POST /v1/transcribe
Authorization: Bearer <key>   (optional)
Body: a WAV file, 16-bit PCM, mono or stereo, 8 to 48 kHz

200 { "text": "Draw me a cat in a hat.", "seconds": 2.4, "ms": 231 }
```

```sh
curl http://localhost:3000/v1/transcribe --data-binary @clip.wav
```

| Status | Meaning |
|---|---|
| 400 | Not a WAV Heyra can read (the message says why) |
| 401 | Unknown key, or no key when `FREE_DAILY` is 0 |
| 408 | The upload took more than 20 seconds to arrive |
| 413 | Longer than 15 seconds free or 30 with a key, or a body over 6 MB |
| 429 | The day's allowance is used up (it resets at midnight UTC) |
| 500 | Transcription failed; it does not count against the allowance |
| 503 | Too busy; retry after `retry-after` seconds |

A clip under 0.3 seconds returns an empty `text` without being transcribed.
`GET /healthz` answers once the model is loaded (the server only listens after
that), with how busy it is and today's clip counts, free and keyed. Any web
page may call the API, and `/llms.txt` describes it for agents.

## Configuration

| Variable | Default | |
|---|---|---|
| `KEYS` | none | Optional keys, comma separated, 24 or more characters each. |
| `KEY_DAILY` | 1000 | Clips per key per day. |
| `FREE_PER_VISITOR` | 100 | Free clips per visitor per day. |
| `FREE_DAILY` | 1000 | Free clips per day for everyone together. 0 means a key is required. |
| `THREADS` | 4 | CPU threads for one transcription. |
| `PORT` | 3000 | |
| `MODEL_DIR` | `/models/parakeet` | Set by the Docker image. |
| `HEYRA_WEB_ROOT` | the page | Set by the Docker image; empty for the API alone. |
| `HEYRA_CONNECT_SRC` | none | Extra hosts the page may send to, space separated `https://` origins (e.g. an analytics endpoint). |

The page takes three optional build arguments:

| Build argument | |
|---|---|
| `HEYRA_SITE` | The public address, e.g. `https://example.com`: adds a canonical link and a share image. |
| `HEYRA_CREDIT_URL` | A "Made by" link in the footer, e.g. `https://example.com`. |
| `HEYRA_LOGGERLIZARD_KEY` | A [LoggerLizard](https://loggerlizard.com) public key for cookieless page analytics. Also set `HEYRA_CONNECT_SRC=https://api.loggerlizard.com` when running. |

```sh
docker build --build-arg HEYRA_SITE=https://example.com -t heyra .
```

For local work on the page, `HEYRA_DEV_API=https://your-heyra-server bun run dev` in `web/`
sends the demo's requests to a running server.

Numbers must be whole: at least 1 for `THREADS` and `PORT`, at least 0 for the
rest. Anything else, including an empty value, stops the server at startup
rather than quietly becoming the default. Days are UTC.

## Privacy

Audio is read in memory, transcribed and dropped. Nothing is written to disk,
and neither audio nor transcripts are logged.

## Layout

One image, one origin. `edge/` is the API (Bun and Hono) and also serves the
page; `web/` is the page (Astro). The page is at `/` and the API under `/v1/`.
`cd edge && bun test` runs the tests with a stand-in recogniser, so it needs no
model.

## Licence

The code is MIT; see [LICENSE](LICENSE). The model, NVIDIA's
[Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), is
CC BY 4.0 and is downloaded at build time as converted by
[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).
