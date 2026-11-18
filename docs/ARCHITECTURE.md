<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Architecture

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
  dynamic imports; `getAdapter`, `allAdapters`, `adapterForDetection` resolve
  them (with a cache and failure eviction); `fieldsBySection` groups adapter
  fields into their declared sections.
- `format-map.js` — `STANDARD_FIELDS` and `FORMAT_FIELDS` map common fields
  (title, artist, album, …) across formats for batch mode;
  `crossFormatPatch`/`crossTarget` build a per-format payload from shared values.
- `metadata-snapshot.js` — `createSnapshot` plus value/key/tag normalizers used
  by change planning and integrity.
- `change-plan.js` — `buildChangePlan()` turns a baseline snapshot plus a
  requested payload into an explicit list of `operations` (field / custom / raw
  / cover) and a minimal write `payload`. No-op edits are dropped; risks are
  attached (e.g. `SIGNED_PDF`, `MKV_REWRITE`, memory warnings); `planSummary()`
  condenses the result.
- `integrity.js` — `verifyIntegrity(plan, afterSnapshot)` re-compares every
  planned change and every *unchanged* field, custom tag, raw tag, XMP property,
  cover, and structure property against the output snapshot. Returns a status
  of `ok` / `warning` / `failed`, a summary, findings, and declared `knownLoss`
  entries. `integrity-rules.js` holds per-format rules for ignored, volatile,
  generated, cover, and known-loss tags.
- `media-proof.js` — bounded-memory SHA-256 proofs over media payload ranges;
  used to justify `MEDIA_RELOCATED` when container offsets change (TIFF strips,
  MP4 `mdat`).
- `memory-estimate.js` — `estimateForSingle` / batch estimates that feed memory
  warnings and blocks (`core/change-plan.js` attaches them as risks).
- `worker-client.js` — `MetadataClient` and `EngineWorker`: one module Worker
  per engine (`exiftool`, `media`, `pdf`), request/response with progress
  messages, per-action timeouts, watchdog restart of crashed/timed-out workers,
  and an idle (~8 min) disposal timer.
- `pwa.js` / `build.js` / `reload-guard.js` — service-worker registration and
  update flow, the `CURRENT_VERSION` marker (must equal `CACHE_VERSION` in
  `sw.js`), and "safe to reload" gating so updates never interrupt processing.
- `history.js` — undo/redo stacks (single file and per batch group), cleared
  after a successful save or when a new file is opened.
- `tag-utils.js`, `image-utils.js`, `errors.js` — value coercion/date helpers,
  cover byte extraction, and the `AppError` type with stable error codes.

### `assets/js/formats/**` — adapters

One module per format: `image.js`, `pdf.js`, `mp3.js`, `flac.js`, `ogg.js`,
`mkv.js`, `mp4.js`, with shared helpers `vorbis-common.js` and
`vorbis-pictures.js`. Each module default-exports an adapter descriptor
(`meta`, `fields`/`fieldsFor`, `sections`/`sectionsFor`, `read`, `write`, and
optional `dispose`). See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-new-format)
for the exact exported shape.

### `assets/js/engines/**` — WASM / library bridges

`exiftool.js` wraps the vendored ExifTool WASM runtime (`readTags`,
`writeTags`, `disposeExifToolRuntime`). Other engines are reached through the
vendored libraries loaded inside the workers (Mediabunny, pdf-lib,
browser-id3-writer, fflate).

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
`review-dialog.js` is the confirmation step: it renders planned operations,
unchanged counts, and risk warnings before any write is authorized.

### `assets/js/i18n/**` — localization

`index.js` provides `t()` / language state; `id.js` and `en.js` are the
Indonesian and English dictionaries. Every UI string must be present in both.

## The single-file pipeline

The path a file takes from selection to download (all in the browser):

1. **Select / drop** — `editor/editor-file.js#openFile` rejects files over
   `MAX_FILE_SIZE` (4 GB), then calls `core/detector.js#detectFile`.
2. **Detect** — magic bytes (with extension cross-check) yield `{ id, subtype,
   ext, mime, label, warning? }`.
3. **Resolve adapter** — `core/registry.js#adapterForDetection` lazy-loads the
   adapter for `detection.id`.
4. **Read** — `core/worker-client.js#MetadataClient.read` posts the file to the
   engine Worker; the adapter's `read()` returns fields, raw/custom tags, info,
   cover, and warnings. A baseline snapshot is created
   (`core/metadata-snapshot.js#createSnapshot`) and the form is rendered.
5. **Edit & plan** — the user changes fields; `editor/editor-changes.js#collectChanges`
   gathers the payload; `core/change-plan.js#buildChangePlan` produces the
   minimal operation list and write payload, attaching risk warnings.
6. **Review** — `ui/review-dialog.js#openReviewDialog` shows exactly what will
   change (and what will not) and asks for confirmation. Nothing is written
   until the user confirms.
7. **Write in a worker** — `editor/editor-save.js#saveMetadata` calls
   `MetadataClient.write`; the adapter applies `plan.payload` through its engine
   and returns a new `Blob` plus a re-read of its own output.
8. **Verify** — `core/integrity.js#verifyIntegrity` compares the output snapshot
   against the plan and the original baseline for fields, custom tags, raw
   tags, XMP, cover, structure, and payload proofs. The result is shown to the
   user (`ok`, `warning`, or `failed`).
9. **Download** — `editor/editor-save.js#downloadResult` creates an object URL
   for the *new* file. The original file is never overwritten.

The batch pipeline (`assets/js/batch/`) repeats steps 4–8 per file through the
same `MetadataClient`, adapters, change planner, and integrity engine, then
assembles a ZIP and JSON/CSV report instead of a single download.

## Service worker / offline strategy

`sw.js` treats the app as a precached, offline-first PWA:

- **Install** — precaches `SHELL_URLS` (HTML pages, CSS bundle, all JS modules,
  fonts, icons, and policy Markdown) into a versioned cache (`CACHE_VERSION`,
  e.g. `meinsert-v44`). Precache fetches use `cache: 'reload'` and
  `credentials: 'same-origin'`; failures are warned, not fatal. Then
  `skipWaiting()` activates the new worker promptly.
- **Activate** — deletes old `meinsert-*` caches and calls `clients.claim()` to
  take control of the current page.
- **Fetch** — GET requests only; anything cross-origin is ignored. Policy
  Markdown and other cacheable assets (CSS/JS/WASM/fonts/images/JSON/SVG/ICO)
  use **cache-first**. Navigations use **stale-while-revalidate**: serve the
  cached shell (falling back to `index.html` / `./`) while refreshing the cache
  in the background, with a 503 offline response if nothing is cached.
- **Version probe** — a `GET_VERSION` message is answered with `VERSION` and
  the current `CACHE_VERSION`. `core/pwa.js#probeActiveWorker` compares it to
  `CURRENT_VERSION` (`core/build.js`) and triggers an update + safe reload when
  they differ. `reload-guard.js` prevents reloading mid-processing.
- Vendored libraries and ExifTool WASM are **not** in the precache; they are
  fetched on first use and then cached by the cache-first asset rule.

Both `CACHE_VERSION` (`sw.js`) and `CURRENT_VERSION` (`assets/js/core/build.js`)
must be bumped together. New offline assets must be added to `SHELL_URLS`.
