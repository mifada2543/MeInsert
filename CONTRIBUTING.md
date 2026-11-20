<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Contributing to MeInsert

MeInsert is a 100% client-side metadata editor: vanilla ES modules, no runtime
bundler or framework, WASM engines in Web Workers, and an installable PWA. User
files never leave the browser. Read the hard rules below before opening a PR.

## Setup

```bash
git clone https://github.com/mifada2543/meinsert.git
cd meinsert                      # place the folder inside your web server's htdocs
npm ci                           # install pinned devDependencies
npm run serve                    # python3 -m http.server 8000 (or point Apache at htdocs)
```

Open `http://localhost/MeInsert/` (or `http://localhost:8000/` when using
`npm run serve`). To test the PWA, open the app in Chrome/Edge and use the
browser menu's **Install app** action; the shell is precached and works offline.

`npm run vendor` copies the pinned runtime libraries from `node_modules` into
`assets/vendor/`. **Only run it when you are updating a library** — the app has
no build step and already ships the vendored files. See
[Adding a dependency](#adding-a-dependency) below.

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run vendor` | Copy pinned runtime libraries into `assets/vendor/` (only when upgrading libraries). |
| `npm run build:css` | Concatenate the modular sources in `assets/css/` into `assets/css/app.bundle.css`. |
| `npm run check:css` | Verify the committed CSS bundle matches its sources (CI check). |
| `npm run build:policies` | Regenerate the policy HTML pages from the Markdown sources. |
| `npm run check:policies` | Verify the generated policy pages match the Markdown sources (CI check). |
| `npm run lint` | Run ESLint over `assets/js`, `sw.js`, `scripts`, and `tests`. |
| `npm run serve` | Serve the folder locally with `python3 -m http.server 8000`. |
| `npm test` | Run the unit tests (`node --test tests/unit/*.test.js`). |
| `npm run test:fast` | Fast local gate: unit + lint + CSS + policy checks, no browser (~3s). |
| `npm run test:e2e` | Browser smoke test (requires Chrome/Chromium; override with `CHROME_BIN`). |
| `npm run test:e2e:all` | All 16 E2E suites in one shared Chrome process (CDP). Set `MEINSERT_E2E_SHARD=1/4` to run a quarter of them. |
| `npm run test:undo` | Single-file undo/redo end-to-end test. |
| `npm run test:undo:batch` | Batch undo/redo end-to-end test. |
| `npm run test:i18n` | Indonesian/English UI end-to-end test. |
| `npm run test:about` | About page and responsive mobile menu. |
| `npm run test:offline` | Storage & Offline settings. |
| `npm run test:reveal` | Scroll-reveal animation and overlay regressions. |
| `npm run test:preview` | Preview open/close animation, including PDF/audio collapse. |
| `npm run test:action-bar` | Compact action bars and Options panels. |
| `npm run test:security` | CSP and no-external-request audit. |
| `npm run test:engine` | WASM engine download progress and retry UI. |
| `npm run test:quick-save` | Quick save preference and behavior. |
| `npm run test:clean` / `npm run test:clean:batch` | Metadata cleaning, single and batch. |
| `npm run test:policy` | One-time policy acknowledgment notice. |
| `npm run test:office` | OOXML/ODF support and byte-preservation. |
| `npm run test:offline:real` | Offline Service Worker scenarios with real request/cache measurement (Chrome). |
| `npm run test:audit` | Portable 24-case audit harness (roundtrip, namespace, ZIP, integrity). |
| `npm run test:independent:office` | Independent Office validation: XML parse + optional `xmllint`/LibreOffice; artefacts in an OS temp dir. |
| `npm run test:independent:audio` | Independent FFmpeg/FFprobe audio verification (skipped explicitly when tools are absent). |
| `npm run test:compat` | Real-file compatibility harness (Chrome, FFmpeg/ffprobe, OpenSSL). |
| `npm run fixtures:generate` | Regenerate optional compatibility fixtures. |

## Hard rules

These are non-negotiable invariants of the project. A change that breaks one of
them will not be merged.

- **No outgoing network for user files.** The app performs no uploads, has no
  analytics, and makes no requests to a non-same-origin URL. All decoding,
  writing, and verification happens locally. The service worker ignores
  cross-origin requests, and the compatibility harness fails on any other
  browser request.
- **The original file is never overwritten.** The flow is always review → write
  → re-read/verify → download a *new* file. Never introduce in-place mutation
  of the user's input.
- **Every new UI string must exist in both dictionaries** — `assets/js/i18n/id.js`
  *and* `assets/js/i18n/en.js`. Use the `t('…')` lookup in code; do not hardcode
  user-facing text.
- **CSS is authored modularly** under `assets/css/`, then committed as the single
  bundle via `npm run build:css`. Do not edit `assets/css/app.bundle.css` by
  hand; run `npm run check:css` to confirm it is current.
- **Policy Markdown changes require `npm run build:policies`.** Edit the `*.md`
  policy sources (`PRIVACY`, `TERMS`, `NOTICE`, including `-en` variants), then
  regenerate the HTML pages and verify with `npm run check:policies`.
- **Offline files must be listed in `sw.js`.** Add any new offline asset to
  `SHELL_URLS`, and bump `CACHE_VERSION` in `sw.js` together with
  `CURRENT_VERSION` in `assets/js/core/build.js` to the same value. The manifest
  test enforces that they match.
- **Vanilla JS only.** No runtime bundler, transpiler, or framework. New
  dependencies are allowed only through `scripts/vendor.mjs`, with a matching
  entry in `assets/THIRD_PARTY_LICENSES.md` and `NOTICE.md` / `NOTICE-en.md`.
  Never add a runtime `npm` dependency the app imports directly from
  `node_modules`.
- **Run the full local gate after each phase:**
  `npm run lint && npm test && npm run check:css && npm run check:policies`.
  (If the `npm run lint` wrapper misbehaves locally, the direct binary works:
  `node node_modules/eslint/bin/eslint.js assets/js sw.js scripts tests`.)
- **One clear commit per subtask.** Keep commits focused and messages descriptive.

## The "reference build" marker

Nearly every source file begins with this three-line header:

```js
/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
```

The `reference build:` line is a **non-functional provenance marker**. No test
evaluates it, and it does not affect runtime behavior. `scripts/build-policies.mjs`
injects the equivalent HTML comment into generated policy pages. It is kept
deliberately for traceability, so **do not remove it mechanically** (for example
with a bulk search-and-replace). Keep it on every new source file.

## Adding a new format

1. **Study the registry and existing adapters.** Read
   `assets/js/core/registry.js` (`ADAPTER_LOADERS`, `getAdapter`,
   `adapterForDetection`, `fieldsBySection`) and one or two adapters in
   `assets/js/formats/` (e.g. `image.js`, `mp3.js`).

2. **Match the observed adapter shape.** An adapter is an ES module whose
   *default export* is an object. The shape used in the codebase is:

   - `meta` — descriptor: `id`, `engine` (`exiftool`, `media`, or `pdf`), `label`,
     `description`, `extensions`, `mime`, and optionally `cover: true`.
   - `fields` / `fieldsFor(subtype)` — field definitions with `id`, `section`,
     `label`, `type`, `native`, `placeholder`, and `maxLength`. `fieldsFor` is
     used when fields vary by subtype; `fields` is the static fallback.
   - `sections` / `sectionsFor(subtype)` — ordered sections with `id`, `title`,
     `description`; each field's `section` must match a section `id`.
     `registry.js#fieldsBySection` groups fields into their sections.
   - `read(file, options)` → `{ fields, raw, custom?, info, cover?, warnings }`.
   - `write(file, payload, options, report)` → `{ blob, fields, raw, custom?,
     info, cover?, warnings }`. It receives the change-plan payload
     (`set`, `remove`, `custom`, `customRemove`, `rawRemove`, `cover`) and must
     re-read its own output so verification can compare it.
   - `dispose()` — optional; release the engine runtime when applicable (see
     `image.js`).

   The default export always includes `meta`, `read`, and `write`; include the
   `fields`/`sections` pair (static or `*For` functions) that the registry and
   change planner expect.

3. **Register it.** Add a lazy `import('../formats/<id>.js')` entry to
   `ADAPTER_LOADERS` in `assets/js/core/registry.js`. Add detection entries in
   `assets/js/core/detector.js`: extension mappings in `EXTENSIONS`, the correct
   extension in `EXT_BY_SUBTYPE`, and magic-byte sniffing in `sniff()` if the
   format can be identified from content. Add any cross-format field mapping in
   `assets/js/core/format-map.js` (`FORMAT_FIELDS` / `STANDARD_FIELDS`).

4. **Make it offline-available.** Add the new adapter path to `SHELL_URLS` in
   `sw.js` and bump the versions (see hard rules). If it needs worker routing,
   register the engine in `assets/js/core/worker-client.js` (`WORKER_URLS`) and
   handle it in the relevant `assets/js/workers/*.worker.js`.

5. **Add fixtures and tests.** Provide a fixture under `tests/fixtures/` (see
   `tests/fixtures/README.md`) and a unit test under `tests/unit/`. Cover
   read → change-plan → write → re-read integrity with the production engine;
   add a case to `tests/compat/` (the real-file harness) so the format is
   exercised with an actual browser/WASM round trip.

6. **Document it.** Update the format tables and notes in `README.md` and
   `README-en.md` (another owner handles those in this release), and add the
   format's known-loss/compatibility caveats to `docs/LIMITATIONS.md`.

## Licensing

By contributing you agree that your work is licensed under AGPL-3.0-or-later,
the same license as the project. See [LICENSE](LICENSE) and the NOTICE files.
