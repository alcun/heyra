# One Heyra image: build the static page, then serve it and /v1 from the same
# Bun process.
FROM oven/bun:1-alpine AS web
WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

# Debian rather than Alpine from here: sherpa-onnx ships glibc binaries.
FROM oven/bun:1-slim AS runtime

# tini as PID 1 reaps orphaned child processes (the service standard).
RUN apt-get update && apt-get install -y --no-install-recommends tini curl bzip2 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The model, in its own layer so a code change does not fetch 640 MB again.
ARG MODEL=sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8
RUN mkdir -p /models && curl -fsSL "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL}.tar.bz2" \
  | tar -xj -C /models && mv "/models/${MODEL}" /models/parakeet && rm -rf /models/parakeet/test_wavs

WORKDIR /app
COPY edge/package.json edge/bun.lock ./edge/
RUN cd edge && bun install --frozen-lockfile --production
COPY edge/src ./edge/src
COPY LICENSE NOTICE ./
COPY --from=web /app/web/dist ./web

ENV MODEL_DIR=/models/parakeet HEYRA_WEB_ROOT=/app/web PORT=3000
EXPOSE 3000
USER bun
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD curl -fsS localhost:3000/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", "run", "edge/src/index.ts"]
