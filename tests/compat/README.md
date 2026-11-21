# Real-file compatibility harness

End-to-end checks that read, edit, write, re-read, and verify **real files**
through the production Workers and WASM engines, with no mocks.

## Contents

- [Quick start](#quick-start)
- [Architecture and assertions](#architecture-and-assertions)
- [Repair results (2026-11-15)](#repair-results-2026-11-15)
- [Wiring](#wiring)

## Quick start

```sh
npm ci
CHROME_BIN=/usr/bin/google-chrome npm run test:compat
```

Requires Chrome/Chromium, FFmpeg/ffprobe, and OpenSSL (`openssl cms`) on PATH. Node 22 is used in
CI. No server-side processing, downloads, uploads, or remote dependencies are
used by the app: the harness serves static local files on a random loopback
port, allows only same-origin GET requests, and fails on other browser requests
or uncaught page errors. Fixture generation is a separate optional developer
command: `npm run fixtures:generate`.

## Architecture and assertions

`run.mjs` schedules isolated Node child processes, one per format group. Each
`worker.mjs` process owns its loopback server, Chrome instance, browser context,
Workers, and WASM runtime. No mutable browser state is shared between jobs.
Cover checks run in their corresponding format job. PDF fixtures share one PDF
job; negative Ogg codecs share a rejection job. Separate ID/EN UI jobs exercise
the real file picker, review, downloads, and cover rejection. Two additional jobs
run expanded MKV timing and multi-picture Vorbis regression suites.

Default concurrency is **2** (or 1 on a single-CPU environment), not all formats
at once. The maximum accepted value is 8; use lower values on memory-limited CI.

```sh
npm run test:compat -- --concurrency 1       # serial, same isolated jobs/assertions
npm run test:compat -- --concurrency 2       # bounded parallel (default)
COMPAT_CONCURRENCY=4 npm run test:compat
npm run test:compat -- --format tiff,mp4,mov # focused diagnosis
```

The scheduler retains deterministic aggregate ordering, preserves failed rows,
reports worker crashes, and imposes a ten-minute job deadline. Changing
concurrency changes scheduling, not assertions. Logs show per-job elapsed time,
local asset bytes/requests, and **Node-only** peak RSS (not total Chrome/WASM
memory). Standalone supplemental suites report unknown local traffic as `-`.
The traffic is localhost disk-to-browser transfer, not an internet download.
More processes duplicate WASM heaps/compilation and can be slower if memory or
CPU is saturated. No fixed speedup is promised.

`worker.mjs` uses playwright-core and real headless Chrome on `single.html`.
`browser.mjs` imports production detection, registry, snapshots, change-plan,
integrity and `MetadataClient`. Every adapter read/write/re-read goes through
the production Web Worker RPC and actual bundled engines, including ExifTool
WASM. No engine or worker mocks. Service workers are blocked to prevent stale
cached code; the separate existing smoke test covers offline/service-worker UI.

The fixture matrix covers JPEG, PNG, WebP, TIFF, MP3, FLAC, Opus, Vorbis, MP4,
MKV, WebM, MOV, M4A, ordinary PDF and genuinely self-signed PDF, plus a mislabeled
PNG and two negative Ogg codecs. Aliases such as `.jpeg`, `.m4v`, and `.oga` are
not separate media fixtures. This is a bounded fixture matrix, not proof for all
files/codecs, chapters, foreign tags, or field combinations.

For each positive fixture:

1. Detect content and perform a real worker read.
2. Supply baseline values plus one changed title to `buildChangePlan`; assert
   the resulting payload contains **only title**, with exactly one operation.
3. Write, independently re-read the resulting Blob through the same worker,
   assert title persisted, and re-detect output container/subtype/extension.
4. Run the unmodified production integrity engine against the complete original
   and re-read snapshots. Any `failed` or unverified result fails the fixture.
   Warnings are printed, not disguised as an entirely clean inventory.
5. For Opus/Vorbis, compare original and output embedded cover bytes exactly,
   even if the separate strict integrity check fails.
6. For signed PDF, independently verify the **original** CMS in Node/OpenSSL,
   compare signature Contents bytes after browser writing, and check original
   read warning and pre-write plan risk. Also report whether the signed ranges
   changed. Signature validity preservation is NOT asserted: current rewriting
   changes signed bytes and invalidates the signature (see fixture README).

Both read and write must reject FLAC-in-Ogg and Speex with useful errors. Real
GIF/BMP covers are written and independently re-read byte-exactly for MP3,
FLAC, Opus, Vorbis and MKV. MP4's production cover policy is checked, then the
real UI is driven to verify rejection of each file and a still-disabled save
button. The MP4 adapter itself is not claimed to enforce the picker policy.

The UI also opens the mislabeled PNG, edits title, reviews, saves, and downloads;
the output label and downloaded name must be `.png`. This checks the **default**
content-following path. The app still offers an explicit “keep original
extension” override in the review dialog; the harness does not assert that
such an override is impossible or that mismatched extensions are rejected.

Per-case tables and findings go to stdout. Any failed invariant exits nonzero;
there is no expected-failure allowlist, silent skip, filter, snapshot mutation,
or weakened integrity policy. Workers/browser/server are closed after testing.

## Repair results (2026-11-15)

The original baseline was 25/33; bilingual defaults exposed three additional
locale-sensitive UI timeouts (22/33). These assertions were not skipped. The
updated matrix has **38 cases across 19 jobs**: the original scenarios, UI in
both languages, and two expanded regression suites. A passing suite includes
assertions that unsupported timing is safely rejected, not a claim every input
is writable.

| Original finding | Repair / evidence |
| --- | --- |
| TIFF strip / MP4-family media offsets | `MEDIA_RELOCATED` only when bounded-memory SHA-256 payload-region proofs match. Invalid/missing proofs cannot earn this exemption. Independent TIFF decoded-pixel hash and MP4-family ffprobe packet hashes/timing/track properties also checked. |
| FLAC vendor | Restored in native FLAC comments, without altering audio frame bytes. |
| Ogg vendor | Still changes to Mediabunny: explicit `ENGINE_VENDOR_CHANGED` warning, only for this exact format/tag/engine signature. Missing vendor, unrelated vendor changes, and ENCODER corruption still fail. |
| Ogg picture metadata | Preserve complete native picture comments instead of regenerating lossy dimensions/types. FLAC native picture blocks are restored separately. Multiple types, Unicode descriptions, dimensions/depth/colors, back covers, keep/set/remove and audio packet hashes checked. |
| MOV UserData title | Declared as a title alias; permitted only for an actual planned title operation, not unrelated edits. |
| MKV duration | Preserve proven constant packet DefaultDuration and original leading timeline. Independently check frame count, compressed SHA-256, PTS and packet duration using ffprobe. No widened duration tolerance. |
| UI timeouts | Explicit ID/EN contexts and language-independent readiness/error selectors; failures capture status, browser errors and screenshots under ignored `tests/tmp-compat-artifacts/`. |

Mediabunny 1.65's Matroska copy path drops DefaultDuration; with reordered B-frames
the final decode-order block is not necessarily the highest-PTS block. The
fixture retains all three frames but loses the highest-PTS frame's duration.
The fix restores a default only after scanning for constant positive durations
and grid-aligned timestamps, then verifies packet timing after the copy.
Output is withheld with WRITE_FAILED if track count or timing cannot be kept.
The expanded corpus includes short/long B-frame video, no B-frames and positive
start timestamps. Off-grid, variable-timing and AAC audio-only/audio+video cases
currently exercise safe rejection; this is a real support limitation, not a
successful remux. The API uses the pinned engine version; reevaluate on upgrade.

Payload proofs are not full decoders: classic TIFF strips/tiles and top-level
MP4 `mdat` are covered. BigTIFF/unsupported structures do not earn an exemption.
Proof generation scans payload ranges in 1 MiB chunks, adding local I/O/CPU to
reads and post-write verification without buffering the whole payload at once.
Proofs alone do not establish sample-table correctness; the fixture harness adds
independent packet/pixel checks. Other metadata remains checked by production
integrity rules. Real corruption fixtures and unit mutations must still fail.

The original signed PDF verifies cryptographically; its output retains Contents
but not signed-range bytes. The separate signatureValidity table column now
explicitly reports **INVALIDATED**, independently checked against output CMS
and ByteRange. A green invariants cell means warning/preservation assertions
passed, NOT that signature validity was preserved.

## Wiring

`package.json`: `test:compat` and `fixtures:generate`; no new npm dependencies.
`.github/workflows/ci.yml`: separate `compat` job with setup-node@v4, Node 22,
npm cache, `npm ci`, Chrome, FFmpeg/ffprobe and OpenSSL. CI uses
`COMPAT_CONCURRENCY=2`. Existing unit/e2e jobs remain separate.

Last verification on 2026-11-15:

- `npm test`: 80/80 pass (including scheduling, proof, duration and picture regressions).
- `npm run lint`: exit 0, no ESLint diagnostics.
- `CHROME_BIN=/usr/bin/google-chrome npm run test:compat -- --concurrency 2`:
  **38/38 pass**, 28.2 seconds on the development machine.
- Same complete checks with `--concurrency 1`: **38/38 pass**, 44.6 seconds.
  These individual local runs are observations, not a cross-machine benchmark.
- `CHROME_BIN=/usr/bin/google-chrome npm run test:e2e`: exit 0, including offline
  reload and mobile layout checks.
- `pdfsig tests/fixtures/signed.pdf`: signature valid, entire document signed;
  expected untrusted self-signed certificate.
