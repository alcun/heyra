# Changelog

All notable changes to Heyra are documented here. Newest first.

## Unreleased

### Added
- MIT licence for the code. The image carries LICENSE and a NOTICE crediting
  NVIDIA's model and its CC BY 4.0 licence, and the page links both.

### Changed
- One simple way in: anyone gets a free allowance with no key (100 clips a day
  each, 1000 in total, 15 second clips), and optional keys get their own
  allowance, 30 second clips, the front of the queue and two places strangers
  cannot take. `KEYS`, `KEY_DAILY`, `FREE_PER_VISITOR` and `FREE_DAILY` replace
  the named client keys and the per-page origin list. Losing the keys can only
  ever fall back to the capped free allowance. The page asks for a key only
  when one is needed; a "Have a key?" link takes one at any time, and free
  recordings stop just short of 15 seconds.
- Nothing is tied to a particular site, and the README covers running it
  locally, in Docker and as the API alone.
- Fonts are served by Heyra itself, so the page makes no third-party requests
  and no longer waits on a font service to render.
- `/healthz` reports today's clip counts, free and keyed. `/llms.txt`
  describes the API for agents, and the page has share tags, structured data
  and a link to the code.
- Settings are checked at startup: a number out of range or empty, or a key
  setting with no keys, stops the server.
- Days reset at midnight UTC. A failed transcription, or a clip that is
  unreadable, too long or too short, does not count against the allowance.

### Fixed
- Simultaneous requests could all pass the daily allowance and the queue limit
  before any was counted. Allowances are now checked and reserved in one step,
  and at most eight requests are handled at once, uploads included. The key is
  checked and a place taken before any of the upload is read, which is capped
  at 6 MB and given up on after 20 seconds.
- A static file linked from outside the page's folder is not served, and a
  malformed address is a 404 rather than an error.
- The page keeps a pasted key as it is, apart from surrounding spaces, cannot
  start a second recording while the microphone is opening, and stops just
  short of 30 seconds.

### Removed
- The refused-key log line, a debugging aid from a one-off problem.

## [0.3.0] - 2026-09-28

### Added
- Web pages listed in `OPEN_ORIGINS` can call without a key, within a small
  allowance per visitor and per day, limited to 15 second clips.

## [0.2.0] - 2026-09-28

### Changed
- The ring around the button is a live level meter: each notch follows a band
  of your voice while you hold, and settles when you let go. A countdown
  appears only in the last five seconds.
- What Heyra heard appears large under the button, with earlier results
  quieter beneath it. Shorter messages throughout, and the code example folds
  away.
- The page keeps only the characters a key can contain when one is pasted.
- A refused key is logged by length and a short fingerprint, never the key
  itself.

## [0.1.0] - 2026-09-28

### Added
- Speech to text over HTTP: POST a short WAV and get the words back, in English
  or 24 other European languages, in about a quarter of a second for a 3 second
  clip. Each caller has its own key and daily allowance. Audio is never stored.
- A page to try it: hold the button, speak, and read what was heard and how
  long it took. It asks for a key once and keeps it in that browser.
