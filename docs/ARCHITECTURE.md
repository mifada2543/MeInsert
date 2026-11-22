<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Architecture

> A map of how MeInsert is organized: source layout, the single-file pipeline,
> and the offline strategy. For user-facing behavior see the
> [README](../README-en.md); for per-format caveats see
> [LIMITATIONS.md](LIMITATIONS.md).

## Contents

- [Overview](#overview)
- [Source map](#source-map)
- [The single-file pipeline](#the-single-file-pipeline)
- [Service worker / offline strategy](#service-worker--offline-strategy)

## Overview

MeInsert is a static, 100% client-side application. There is no server-side
component: the browser loads ES modules directly and does all reading, writing,
verification, and ZIP assembly locally. The three HTML entry points are
`index.html` (home), `single.html`, and `batch.html` (both editors), plus
`privacy.html` and `Terms.html` (generated policy pages). `home.js` and `app.js`
are the small entry modules; `app.js` dynamically imports `batch/batch-view.js`
only on the batch page.

**No upload. No analytics. No external requests.** Detection, decoding, writing,
and verification never leave the browser. The service worker ignores any
request whose origin differs from the app's own origin (`sw.js`), and the
compatibility harness (`tests/compat/`) fails on any other browser request.

## Source map

### `assets/js/core/**` — format-agnostic logic

- `detector.js` — content-first detection. `detectFile()` reads the first 128
  bytes and sniffs magic bytes (`sniff`, `sniffMp4Brand`, `sniffEbml`,
  `sniffOgg`), then compares against the extension map (`EXTENSIONS`,
  `EXT_BY_SUBTYPE`). A mismatch produces a warning and the detected type wins.
- `registry.js` — lazy adapter loading. `ADAPTER_LOADERS` maps format ids to
  dynamic imports; `getAdapter` and `adapterForDetection` resolve
  them (with a cache and failure eviction); `fieldsBySection` groups adapter
  fields into their declared sections.
- `format-map.js` — `STANDARD_FIELDS` and `FORMAT_FIELDS` map common fields
  (title, artist, album, …) across formats for batch mode;
  `crossFormatPatch`/`crossTarget` build a per-format payload from shared values.
- `metadata-snapshot.js` — `createSnapshot` plus value/key/tag normalizers used
  by change planning and integrity.
- `change-plan.js` — `buildChangePlan()` turns a baseline snapshot plus a
  requested payload into an explicit list of `operations` (field / custom / raw
  / cover / `sidecar`) and a minimal write `payload`. No-op edits are dropped;
  risks are attached (e.g. `SIGNED_PDF`, `MKV_REWRITE`, memory warnings).
- `timed-text.js` — DOM-free LRC/SRT/WebVTT parser and serializer, plus cue
  style normalization (`normalizeCueStyle`, `cueStyleToCss`,
  `cueStyleToSettings`). `serializeVtt(cues, style)` emits a `STYLE` block,
  `<c.mi-cue>` wrappers and position/alignment cue settings that survive the
  MKV/MP4 muxers. Ported from MEeL (see the third-party attributions).
- `integrity.js` — `verifyIntegrity(plan, afterSnapshot)` re-compares every
  planned change and every *unchanged* field, custom tag, raw tag, XMP property,
  cover, and structure property against the output snapshot. Returns a status
  of `ok` / `warning` / `failed`, a summary, findings, and declared `knownLoss`
  entries. `integrity-rules.js` holds per-format rules for ignored, volatile,
  generated, cover, and known-loss tags.
- `media-proof.js` — bounded-memory SHA-256 proofs over media payload ranges;
  used to justify `MEDIA_RELOCATED` when container offsets change (TIFF strips,
  MP4 `mdat`).
- `media-cut.js` / `mp3-cut.js` — trim contract helpers: `normalizeTrim()`,
  `conversionCutOptions()`, `expectedCutDuration()`, and `mediaRangeProof()`;
  `mp3-cut.js` slices whole MPEG frames while keeping ID3 bytes verbatim.
- `memory-estimate.js` — `estimateForSingle` / batch estimates that feed memory
  warnings and blocks (`core/change-plan.js` attaches them as risks). The
  estimate now also considers an optional observed peak reported by the client.
- `memory-meter.js` — opt-in (`?mem=1`) instrumentation that records the largest
  message/result payloads crossing the worker boundary. Normal runs do no work.
- `worker-client.js` — `MetadataClient` and `EngineWorker`: one module Worker
  per engine (`exiftool`, `media`, `pdf`), request/response with progress
  messages, per-action timeouts, watchdog restart of crashed/timed-out workers,
  and an idle (~8 min) disposal timer. Payload `ArrayBuffer`s are cloned and
  **transferred** (not copied twice), so editor state is never detached.
- `pwa.js` / `build.js` / `reload-guard.js` — service-worker registration and
  update flow, the `CURRENT_VERSION` marker (must equal the shell `CACHE_VERSION`
  in `sw.js`) plus the independent `ENGINE_VERSION` marker for optional engines,
  and "safe to reload" gating so updates never interrupt processing.
- `history.js` — undo/redo stacks (single file and per batch group), cleared
  after a successful save or when a new file is opened.
- `tag-utils.js`, `image-utils.js`, `errors.js` — value coercion/date helpers,
  cover byte extraction, and the `AppError` type with stable error codes.

### `assets/js/formats/**` — adapters

One module per format: `image.js`, `pdf.js`, `mp3.js`, `flac.js`, `ogg.js`,
`mkv.js`, `mp4.js`, with shared helpers `vorbis-common.js` and
`vorbis-pictures.js`. OGG/Opus writes use `core/ogg-comment.js#rewriteOggCommentBlob`
to patch only the leading comment pages via `Blob.slice()`; unsafe/multi-page
comments fall back to a full remux. MP3 writes use `core/id3-passthrough.js` to patch the
existing ID3v2.3/v2.4 tag surgically, preserving untouched frames verbatim;
`core/id3-sylt.js` handles synchronized-lyrics frames. Each module default-exports
an adapter descriptor
(`meta`, `fields`/`fieldsFor`, `sections`/`sectionsFor`, `read`, `write`, and
optional `dispose`). See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-new-format)
for the exact exported shape.

The image adapter also resolves several new subtypes. **HEIC/HEIF** writes XMP
on a best-effort basis, and still RAW files (DNG, CR2, CR3, NEF, ARW, ORF, RW2,
RAF) are **XMP-only**. Both return a **placeholder preview** rather than decoded
pixels, because the browser cannot render these formats natively; raw sensor
data is never decoded or rewritten. CinemaDNG carried inside MOV/MKV keeps
resolving to the `mp4`/`mkv` adapters, so its chapter/offset behavior follows the
container adapter.

A separate **read-only `raw-video` adapter** covers BRAW, R3D, and ARRIRAW: its
`read()` exposes fields and warnings, but there is no write path. Read-only
detections are marked as a risk in `core/change-plan.js#buildChangePlan`, and a
**save guard** in `editor/editor-save.js#saveMetadata` (mirrored in
`batch/batch-save-flow.js`) rejects the write before any engine work starts, so
these files can be inspected but never exported or overwritten.

Office metadata uses two worker-safe helpers: `core/office-xml.js` is a small
namespace-aware parser/writer (URI + local name resolution, arbitrary prefixes,
default namespaces, prefix shadowing, entity decoding, DTD/external entity
rejection) that edits XML by surgical byte ranges so untouched attributes,
comments and elements remain identical; `core/office-package.js` performs
bounded semantic validation of OOXML content types, root relationships and the
main document part, and of ODF manifest/mimetype/content parts. This is
structural/XML validation, **not** full Office schema conformance. Detection
and inspection use `core/zip-directory.js` (bounded central-directory reads
through `Blob.slice()`) and `core/office-zip.js` (selective inflation of only
metadata/preview parts with actual-byte decompression budgets).

### `assets/js/engines/**` — WASM / library bridges

`exiftool.js` wraps the vendored ExifTool WASM runtime (`readTags`,
`writeTags`, `disposeExifToolRuntime`). Other engines are reached through the
vendored libraries loaded inside the workers (Mediabunny, pdf-lib,
browser-id3-writer, fflate). The ExifTool worker fetches the content-hashed raw
Brotli asset (`.br`) on the first image operation (3,638,320 bytes). The host
serves those bytes verbatim as `application/wasm` with no `Content-Encoding`, so
Fetch never expands the response. The worker verifies the compressed SHA-256,
decodes with native Brotli where available or the bundled ~91 KB JavaScript
decoder otherwise, then checks the expanded WASM length and SHA-256. There is no
gzip fallback. The request, decompression and metadata work stay local.

The explicit image offline pack caches the same raw `.br` payload for
portability, and a worker reuses a cached pack before fetching. The PWA engine
cache (`meinsert-engine-v4`) also reuses the on-demand Brotli response. Because
no host sets `Content-Encoding`, Cache Storage holds exactly the same
3,638,320 compressed bytes everywhere: that is the per-transfer and per-cache
cost of the engine. The whole image offline pack is 4,822,620 bytes, and every
optional feature together is 5,568,488 bytes offline.

To reproduce the assets, run `npm ci`, then `npm run vendor` with Node 24.22.3.
The build checks the pinned upstream hash, rewrites the embedded Perl file
table, strips POD from retained ExifTool source, and optimizes with Binaryen 125
(`-Oz --strip-debug`, bulk memory, sign extension and nontrapping float-to-int).
The upstream already contains no custom/debug sections. The shared tag table
keeps stable indexes, with entries for removed modules skipped. The build
writes Brotli level 11 with a 24-bit window and `core/image-engine-build.js`.
If upgrading the pinned upstream version, audit
the VFS layout. The build synchronizes the service worker pins.
`npm run check:assets` checks the WASM signature, sizes, SHA-256 and asset paths.

### `assets/js/workers/**` — off-main-thread execution

`rpc.js` is the shared worker RPC helper. `exiftool.worker.js`,
`media.worker.js`, and `pdf.worker.js` dispatch `read` / `write` / `dispose`
actions to the matching adapter inside a Worker, streaming `progress` messages
back to `core/worker-client.js`. Keeping WASM engines in workers avoids blocking
the UI and lets memory be reclaimed on dispose.

### `assets/js/editor/**` — single-file editor

`editor-state.js` holds the state object and `MAX_FILE_SIZE` (4 GB);
`editor-file.js` opens a file (size guard → `detectFile` → `adapterForDetection`
→ `client.read` → baseline snapshot); `editor-view.js` renders tabs, the form,
and the workspace; `editor-changes.js` collects changes and the action bar;
`editor-save.js` drives save/download; `editor-shell.js` builds the layout and
progress UI.

### `assets/js/batch/**` — batch editor

`batch-view.js` / `batch-controller` orchestration, `batch-item.js`,
`batch-groups-view.js`, `batch-detail-view.js`, `batch-preview.js`, and
`batch-history.js` manage selection, grouping, preview, and undo per group;
`batch-limits.js` enforces per-type limits; `batch-processor.js` and
`batch-save-flow.js` drive worker reads/writes and verification;
`batch-report.js` builds JSON/CSV reports; `batch-zip.js` streams a ZIP to disk
via the File System Access API when available, otherwise in memory (fflate).

### `assets/js/ui/**` — shared UI components

`dom.js`, `icons.js`, `toast.js`, `theme.js`, `form-view.js`, `raw-view.js`,
`result-view.js`, `file-card.js`, `review-dialog.js`, `confirm.js`,
`lightbox.js`, `media-session.js`, `editing-navigation.js`, and `policy-toc.js`.

Newer shell and utility modules:

- `mobile-menu.js` — responsive ☰ menu that morphs into an ✕.
- `action-bar.js` and `batch-action-bar.js` — compact pinned action bars with an
  **Options** panel.
- `offline-settings.js` — Frugal / Mostly ready / Download everything.
- `format-chips.js` and `core/format-capabilities.js` — format capability labels.
- `scroll-reveal.js` — scroll entrance animation.
- `clean-metadata.js` — privacy profiles.
- `timed-text-editor.js` — synchronized lyrics/subtitles editor: extension-driven
  audio/video mode, two-column preview, karaoke view, per-line timestamping, a
  video-only floating appearance card with a dark (non-blurred) backdrop (click
  outside to close), a context-switching primary button (**Apply** /
  **Save preference**), and local draft saving.

The standalone `about.html` page uses `assets/css/pages/about.css` and is part of
the precached app shell. `review-dialog.js` is the confirmation step: it renders
planned operations, unchanged counts, and risk warnings before any write is
authorized.

### `assets/js/i18n/**` — localization

`index.js` provides `t()` / language state; `id.js` and `en.js` are the
Indonesian and English dictionaries. Every UI string must be present in both.

## The single-file pipeline

The path a file takes from selection to download (all in the browser):

```mermaid
flowchart LR
    A[Select / drop] --> B[Detect]
    B --> C[Resolve adapter]
    C --> D[Read in Worker]
    D --> E[Edit & plan]
    E --> F[Review]
    F --> G[Write in Worker]
    G --> H[Verify]
    H --> I[Download new file]
```

Each stage in detail:

1. **Select / drop** — `editor/editor-file.js#openFile` rejects files over
   `MAX_FILE_SIZE` (4 GB), then calls `core/detector.js#detectFile`.
2. **Detect** — magic bytes (with extension cross-check) yield `{ id, subtype,
   ext, mime, label, warning? }`.
3. **Resolve adapter** — `core/registry.js#adapterForDetection` lazy-loads the
   adapter for `detection.id`.
4. **Read** — `core/worker-client.js#MetadataClient.read` posts the file to the
   engine Worker; the adapter's `read()` returns fields, raw/custom tags, info,
   cover, and warnings. Audio/video adapters may also return a `sidecar`
   (synchronized lyrics/subtitle cues). A baseline snapshot is created
   (`core/metadata-snapshot.js#createSnapshot`) and the form is rendered. Image
   fields are grouped into sections; section `lokasi` is rendered only in the
   separate `gps` tab, keeping the general Metadata tab compact.
5. **Edit & plan** — the user changes fields, opens the timed-text editor
   (`ui/timed-text-editor.js`, ported from MEeL — see third-party attributions),
   or opens the trim dialog (`ui/media-cut-editor.js`). The trim dialog stages a
   `trim` range (`{ start, end, mode }`, seconds) in `state.trim` through
   `editor/editor-state.js#setTrim`; it never decodes media bytes and is recorded
   as a `trim` history change. `normalizeTrim()` from `core/media-cut.js`
   validates the range against the media duration and `CUT_MODES` (`copy` is the
   safe default, `precise` may transcode). Line drafts autosave to `localStorage`
   keyed by file identity and are cleared on **Apply**; appearance preferences
   persist separately in `meinsert-timed-text-style-v1`. The preference panel
   is a compact card inside the editor pane: the `+ Line` / gear / `Show: Subtitle`
   toolbar stays visible above it, and the primary action remains **Save preference**.
   `ui/change-history.js#mountChangeHistory` opens the change-history panel
   (`.history-dialog`) from the editor head: it lists the current state plus
   the labelled entries from `core/history.js#historyEntries`, newest first.
   Rolling back calls `core/history.js#rollbackTo` after confirmation, then
   re-syncs the action bar and workspace; the rollback itself is undoable.
   `editor/editor-changes.js#collectChanges` gathers the payload including the
   `sidecar` and the pending `trim`, and
   `core/change-plan.js#buildChangePlan` produces the minimal operation list and
   write payload, attaching risk warnings.
6. **Review** — `ui/review-dialog.js#openReviewDialog` shows exactly what will
   change (and what will not) and asks for confirmation. Nothing is written
   until the user confirms.
7. **Write in a worker** — `editor/editor-save.js#saveMetadata` calls
   `MetadataClient.write`; the adapter applies `plan.payload` through its engine
   and returns a new `Blob` plus a re-read of its own output. When `state.trim`
   is present, the write path performs a **cut operation**: `core/media-cut.js`
   supplies `conversionCutOptions()` (copy-forced vs. precise/boundary-shrink)
   and `expectedCutDuration()`, while MP3 uses `core/mp3-cut.js#sliceMp3Range`
   to emit only whole frames inside the window and copy ID3v2 bytes verbatim.
   For timed text, `mkv.js`/`mp4.js` add a WebVTT track containing the `STYLE`
   block from `core/timed-text.js`, and verify A/V packet equivalence before
   releasing the result. Cut output that would exceed the memory policy is
   treated like any other large write: `warn` is dismissible, `block` requires
   low-memory mode or explicit acknowledgement, and worker payloads are
   transferred rather than copied. A read-only RAW video detection stops at the
   save guard: no write is dispatched and no output blob is produced.
8. **Verify** — `core/integrity.js#verifyIntegrity` compares the output snapshot
   against the plan and the original baseline for fields, custom tags, raw
   tags, XMP, cover, structure, and payload proofs. For a cut, the retained
   media packets are checked with the bounded-memory **range proof**
   (`core/media-cut.js#mediaRangeProof`, `av-range-v1`): it hashes encoded
   packets inside `[start, end)` together with their durations, so a container
   rewrite that keeps the compressed samples still verifies. The same memory
   policy applies to verification buffers, and the result is shown to the user
   (`ok`, `warning`, or `failed`).
9. **Download** — `editor/editor-save.js#downloadResult` creates an object URL
   for the *new* file. The original file is never overwritten.

The batch pipeline (`assets/js/batch/`) repeats steps 4–8 per file through the
same `MetadataClient`, adapters, change planner, and integrity engine, then
assembles a ZIP and JSON/CSV report instead of a single download.

## Service worker / offline strategy

`sw.js` treats the app as a precached, offline-first PWA with **two independent
caches**:

- **Shell cache** (`CACHE_VERSION`, e.g. `meinsert-v72`) holds the always-needed
  app shell. **Engine cache** (`ENGINE_VERSION`, e.g. `meinsert-engine-v4`) holds
  the optional format engines downloaded on demand. Separating them means a
  shell update never discards engines the user already paid to download, and
  clearing optional engines never removes shell assets. The two version markers
  are mirrored by `CURRENT_VERSION` and `ENGINE_VERSION` in
  `assets/js/core/build.js`; the worker is a classic script and cannot import
  the module, so tests keep the copies in sync.
- **Install** — precaches `SHELL_URLS` (HTML pages, CSS bundle, all JS modules,
  including `core/zip-directory.js`, fonts, icons, and policy Markdown) into the
  shell cache. Precache fetches use `cache: 'reload'` and
  `credentials: 'same-origin'`; failures are warned, not fatal. Then
  `skipWaiting()` activates the new worker promptly.
- **Activate** — first migrates optional entries from the legacy single cache
  (`meinsert-v51`) into the engine cache, skipping anything already in the
  shell. Upgrading from `meinsert-engine-v3` to `v4` deliberately does not copy
  files under `/exiftool-wasm/`: the raw `.br` payload is downloaded once into
  the new engine cache and reused from then on. Finally the worker deletes old
  `meinsert-*` caches except the two *active* caches, and calls
  `clients.claim()` to take control of the current page.
- **Fetch** — GET requests only; anything cross-origin is ignored. A
  shell URL uses **cache-first against the shell cache**; any other cacheable
  asset (vendor library, WASM, format adapter) uses cache-first against the
  engine cache. Navigations are **network-first with a shell cache fallback**:
  try the network, then serve the cached shell (falling back to `index.html` /
  `./`), with a 503 offline response if nothing is cached. This avoids a blank
  page on Ctrl+R when the network is slow or unavailable.
- **Optional cache protocol** — only six message types are accepted:
  `SKIP_WAITING`, `GET_VERSION`, `CACHE_OPTIONAL`, `CLEAR_OPTIONAL`,
  `OPTIONAL_STATUS` and `CANCEL_OPTIONAL`. Anything else gets an `OPTIONAL_ERROR`
  reply. `CACHE_OPTIONAL` validates a unique `jobId`, an `ENGINE_VERSION`, and
  1–128 URLs against `KNOWN_OPTIONAL_URLS` (the exact union of
  `OFFLINE_FEATURES[*].urls` kept in sync by a test); arbitrary same-origin
  URLs and `blob:`/`data:`/`file:` URLs are rejected. `assets/js/ui/offline-settings.js`
  sends that same engine version, so a shell update in the middle of a download
  cannot cancel it with a version mismatch.
- **Optional cache reuse** — before any network request the worker looks up the
  URL in the engine cache. An entry is reused only if the response is `ok` and
  carries `X-MeInsert-Engine-Version: <ENGINE_VERSION>`; otherwise it is
  re-fetched and replaced. A `Map<url, Promise>` deduplicates concurrent
  fetches of the same URL, an `AbortController` per job implements cancel, and
  entries whose declared `Content-Length` exceeds 96 MiB are refused. Progress
  replies include `bytes`/`totalBytes` when the length is known; `!ok` responses
  are never cached. A second install of unchanged assets therefore transfers
  zero bytes.
- **UI states** — the settings panel tracks `queued`, `downloading`, `cached`,
  `failed` and `cancelled` per `jobId`. Messages from any other job (including
  a previous dialog session or after `pagehide`) are ignored. There is no
  30-second total deadline: only a 60-second inactivity timer, reset by every
  entry/byte progress message, stops a stalled job. Retry and cancel controls
  are available for terminal states.
- **Version probe** — a `GET_VERSION` message is answered with `VERSION`, the
  current shell `CACHE_VERSION` and the current `engineVersion`.
  `core/pwa.js#probeActiveWorker` compares `version` to `CURRENT_VERSION`
  (`core/build.js`) and triggers an update + safe reload when they differ.
  Registration uses `updateViaCache: 'none'` so the browser always revalidates
  `sw.js`; `reload-guard.js` prevents reloading mid-processing.
- Vendored libraries and ExifTool WASM are **not** in the shell precache; they
  are fetched on first use into the engine cache, or saved there by the
  optional download UI.

`SHARED_SHELL_URLS` in `core/format-capabilities.js` lists the small set of
modules (worker RPC, `errors`, `tag-utils`, `image-utils`, `integrity-rules`)
that every optional engine imports at startup. `tests/unit/offline-manifest.test.js`
walks the **static and dynamic** import graph from every feature entry — including
`import('...')` with either quote style, re-exports and `new Worker(new URL(...))`
— and asserts the closure is fully covered by that shared set or the feature's
own `urls`, that every URL exists on disk, and that no vendored/WASM asset
leaked into the shell. Assets reached only at runtime through a `fetch()` or a
computed URL (the ID3 writer, `engines/exiftool.js`, the ExifTool WASM) are
declared explicitly; tests fail if a declared dependency is removed from a URL
list, and an in-memory graph verifies nested dynamic imports are followed
transitively. This is why `browser-id3-writer.mjs` belongs to the audio feature,
`engines/exiftool.js` and `mediabunny.mjs` to the image/video feature, and
`office-xml.js`/`office-package.js` to the office feature and the shell.

Bump `CACHE_VERSION` (`sw.js`) and `CURRENT_VERSION` (`assets/js/core/build.js`)
together for shell changes. `ENGINE_VERSION` changes only when the optional
engine format changes. New always-needed assets must be added to `SHELL_URLS`.
