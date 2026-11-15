<div align="center">

<img src="assets/img/icon-512.png" alt="MeInsert" width="120" height="120" />

# MeInsert

[🇮🇩 Indonesia](README.md) · **🇬🇧 English**

**Edit metadata without uploading — entirely in your browser**

Read and write image, PDF, audio, and video metadata directly on your device.
No backend. No uploads. No account.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_Now-2ea44f?style=for-the-badge)](https://meinsert.my.id/)
[![PWA](https://img.shields.io/badge/PWA-Installable-7B3FF2?style=for-the-badge)](https://meinsert.my.id/)
[![Offline](https://img.shields.io/badge/Offline-Ready-10b981?style=for-the-badge)](https://meinsert.my.id/)
[![CI](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml/badge.svg)](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml)

[![Version](https://img.shields.io/badge/version-v1.2.0-blue?style=for-the-badge)](./package.json)
[![License](https://img.shields.io/badge/License-AGPLv3-orange?style=for-the-badge)](./LICENSE)
[![Client-side](https://img.shields.io/badge/100%25_Client--side-lightgrey?style=for-the-badge)]()
[![No Build](https://img.shields.io/badge/Static-No%20Build-purple?style=for-the-badge)]()

![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-624DE3?style=flat-square)
![Service Worker](https://img.shields.io/badge/Service_Worker-PWA-61DAFB?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square)

<br/>

[🚀 Try the Live Demo](https://meinsert.my.id/) ·
[📄 Edit a Single File](./single.html) ·
[📦 Batch Processing](./batch.html) ·
[⚙️ Installation](#quick-installation-xampp)

![Preview](assets/img/og-image.png)

</div>

> **MeInsert** is a local, browser-based metadata editor. Processing happens client-side using WebAssembly and Web Workers: your files stay on your device. The app shell works offline after caching; format engines become available offline after their dependencies have been loaded.

---

## Contents

- [Why MeInsert?](#why-meinsert)
- [Supported Formats](#supported-formats)
- [Getting Started in 30 Seconds](#getting-started-in-30-seconds)
- [Features](#features)
- [Interface Language](#interface-language)
- [Quick Installation (XAMPP)](#quick-installation-xampp)
- [Technology](#technology)
- [Limitations](#limitations)
- [Development](#development)
- [License](#license)
- [Usage and Privacy Policies](#usage-and-privacy-policies)

---

## Why MeInsert?

| 🔒 Local Processing | ⚡ Lightweight Deployment | 📴 Offline Support |
|---|---|---|
| Files are read and written in the browser using WASM and Workers. No file uploads. | Static files: no backend or deployment build step. Runs directly on XAMPP/Apache. | The app shell works offline after caching completes. Format engines and WASM work offline after they have been loaded. |

**Two modes, one principle:**
- **Single file** — individual editing with fields tailored to the detected format.
- **Batch** — inspect files, edit format groups or use shared cross-format fields, and download a ZIP with JSON/CSV reports.

---

## Supported Formats

Automatic detection uses **magic bytes**, not just filename extensions. Only the relevant fields for the detected format are displayed.

| Category | Formats | Writing Method |
|---|---|---|
| 🖼️ **Images** | JPEG, PNG, WebP, TIFF | XMP + EXIF; IPTC for JPEG/TIFF |
| 📄 **PDF** | PDF | Info Dictionary + XMP stream |
| 🎵 **Audio** | MP3, FLAC, OGG Vorbis / Opus | ID3v2.3, Vorbis Comment; stream-copy remuxing |
| 🎬 **Video** | MP4 / M4A / MOV, MKV / WebM | ItemList + XMP through ExifTool; Matroska SimpleTag with stream-copy remuxing |

### Cover Art / Thumbnails

Embed JPEG/PNG/WebP covers up to 10 MB. GIF/BMP covers are also supported for MP3, FLAC, OGG/Opus, and MKV. Covers use native structures: MP3 `APIC`, FLAC/OGG/Opus `METADATA_BLOCK_PICTURE`, MP4/M4A `covr` (JPEG/PNG/WebP only), and Matroska attachments for MKV/WebM. Covers can be replaced or removed. Some players do not display Ogg covers.

---

## Getting Started in 30 Seconds

### 1. Choose a File

Open the home page and select **Single file** for individual editing or **Batch** for multiple files.

### 2. Edit Metadata

Fields appear according to the format. Change the fields you need, add **custom tags**, replace cover art, or clear fields to remove tags.

### 3. Save and Download

Select **Save**, review the changes, and confirm. The output is read again and verified before downloading a new file or batch ZIP. The original file is never overwritten.

> **Change tracking:** only requested field changes are submitted for writing. This does not guarantee preservation of every unsupported tag; review integrity findings and the limitations below. The output extension follows detected content by default; the mismatch review dialog also offers an explicit option to keep the original extension. Renaming a file does not convert its format.

---

## Features

### Single File or Batch?

| | Single File | Batch |
|---|---|---|
| Limits | Up to 4 GB per file | Up to 10 video files, 20 audio files, or 50 images/PDFs |
| Editing | Format-specific fields, custom tags, searchable raw table | Format groups or shared cross-format fields, file selection, per-file raw tags |
| Output | Verified file with controlled naming | ZIP + JSON/CSV reports |

### More Features

- **Extension warnings** — mismatches between extensions and magic bytes are shown in both modes; processing follows detected content.
- **Review before writing** — inspect changed fields, custom tags, raw tags, and covers. No-op changes are omitted.
- **Automatic verification** — output is read again; fields, custom tags, raw tags, PDF XMP properties, covers, and file structure outside the change plan are compared.
- **Custom tags** — add non-standard metadata using native engine tag names.
- **Raw-tag search** — inspect and search raw metadata.
- **Fullscreen preview** — open image and cover previews in a lightbox; zoom, pan, and press Escape to close.
- **Light/dark theme** — follows the system or a manual preference, with a circular-reveal transition and early theme initialization.
- **Indonesian / English** — select **ID / EN** beside the theme button. The preference stays on your device; metadata values are not translated.
- **Mobile editing focus** — the Single file/Batch navigation is hidden during editing/processing and returns after results are ready or when returning to file selection. Desktop navigation is unchanged.
- **Installable PWA** — install from the browser menu. The app shell is precached; vendor libraries and ExifTool WASM are cached on first use.
- **WASM memory management** — Workers and the ExifTool runtime are released after batch processing, after idle time (about eight minutes), and when the page closes.

---

## Interface Language

Select **ID** (Indonesian) or **EN** (English) beside the theme button on the home, single-file, or batch page.

- The preference is stored locally under `meinsert-language`.
- Without a saved preference, Indonesian/English browser language is used; other languages fall back to Indonesian.
- Switching language does not reload the page or change files, metadata values, technical tag names, or JSON/CSV report schemas.
- The preference applies across pages and works offline with the app shell.
- Documentation: **[Indonesian](README.md)** · **[English](README-en.md)**.

---

## Quick Installation (XAMPP)

No deployment build is needed. HTML/CSS/JS and vendor files are included in the repository.

```bash
# 1. Clone into htdocs
cd /opt/lampp/htdocs
git clone https://github.com/mifada2543/meinsert.git MeInsert
cd MeInsert

# 2. Development dependencies / vendor updates
npm install
npm run vendor

# 3. Open in your browser
# http://localhost/MeInsert/
# Use Install / Add to Home Screen for the PWA
```

> Stay online until the service worker finishes caching the app shell. Then `/`, `/single.html`, and `/batch.html` can open offline. Vendor libraries, format adapters, and ExifTool WASM (~27 MB) are fetched and cached when used; processing that format works offline once all its dependencies have loaded.

**Note:** `assets/vendor/` is already bundled. Run `npm run vendor` only when updating libraries.

For a local server without XAMPP:

```bash
npm run serve  # http://localhost:8000
```

---

## Technology

| Layer | Technology |
|---|---|
| **App** | Vanilla JS (ES2022), HTML5, CSS3; responsive and dark-mode styling |
| **PWA** | Manifest + Service Worker; precached app shell, on-demand vendors and WASM |
| **Image/MP4 engine** | ExifTool WASM (~27 MB), lazy-loaded through a Worker |
| **Media engine** | Mediabunny for MP3/FLAC/OGG/MKV processing |
| **PDF engine** | pdf-lib for Info Dictionary and XMP streams |
| **ID3** | browser-id3-writer |
| **Batch ZIP** | fflate |
| **Workers** | One Worker per engine, RPC, disposal and idle timeout |

<details>
<summary><strong>Architecture and project layout</strong></summary>

### Workflow

1. **PWA** — precache the app shell; cache format dependencies on demand.
2. **Detection** — `detector.js` inspects the first 128 bytes for format and subtype.
3. **Adapter** — `registry.js` selects a format adapter.
4. **Worker** — `worker-client.js` starts the engine Worker with disposal/idle timeout.
5. **Read** — `read(file)` normalizes standard fields and raw tags.
6. **UI** — render format fields, custom tags, and the raw table.
7. **Write** — collect requested changes and call `adapter.write(file, payload)`.
8. **Verify** — re-read output and compare the results against the plan.
9. **Download** — return a Blob download or a batch ZIP.

**Static routes:** `/` (mode selection), `/single.html`, `/batch.html`. All are precached for offline navigation.

### Project Layout

```text
MeInsert/
├── index.html                 # Home: choose Single file / Batch
├── single.html                # Single-file editor
├── batch.html                 # Batch inspection and editing
├── README.md                  # Indonesian documentation
├── README-en.md               # English documentation
├── manifest.json              # PWA manifest
├── sw.js                      # App shell cache; on-demand vendors/WASM
├── .htaccess                  # MIME types and cache headers
├── package.json               # Development dependencies and scripts
├── scripts/vendor.mjs         # node_modules → assets/vendor/
├── scripts/build-css.mjs      # Modular CSS → app.bundle.css
├── eslint.config.js           # ESLint flat configuration
├── tests/
│   ├── e2e/smoke.mjs          # Browser/PWA/batch smoke test
│   ├── compat/                # Real Worker/adapter browser harness
│   ├── fixtures/              # Small synthetic media and generator
│   └── unit/                  # Metadata, integrity, UI helpers, manifests
└── assets/
    ├── css/app.css            # Modular CSS entry point
    ├── css/app.bundle.css     # Generated, tracked delivery bundle
    ├── js/
    │   ├── home.js            # Home boot: theme, language, service worker
    │   ├── app.js             # Editor/batch application entry
    │   ├── editor/            # State, shell, changes, views, intake, saving
    │   ├── i18n/              # Language runtime and ID/EN dictionaries
    │   ├── core/              # Detection, registry, plans, integrity, RPC client
    │   ├── batch/             # Controller, groups, detail, preview, save, ZIP
    │   ├── engines/exiftool.js
    │   ├── formats/           # Image, PDF, MP3, FLAC, Ogg, MKV, MP4
    │   ├── ui/                # Shared forms, dialogs, previews, theme, toast
    │   └── workers/           # RPC and engine Workers
    └── vendor/                # Bundled third-party libraries
```

### Technical Notes

- **ExifTool WASM** is loaded on demand through a Worker. Initial download time depends on the connection/device; subsequent uses can use the service-worker cache.
- **Loading:** the home page uses a small entry point. Format adapters and batch UI are dynamically imported when needed.
- **CSS:** modular styles are delivered as one tracked `app.bundle.css`, avoiding the original chain of 26 CSS requests.
- **Header logo:** `logo-96.png` (~2.4 KB, 96×96) is used for a 42 CSS-pixel display; 192/512 PWA icons remain separate.
- **PDF:** only requested XMP properties are rewritten when safely parseable. Foreign properties are inventoried before and after writing. Malformed XMP may require a warned fallback rewrite and can lose unknown properties.
- **MP3:** old ID3 tags are rewritten; unsupported frames can be lost. Supported TXXX tags are retained.
- **FLAC/OGG/MKV:** Mediabunny uses `copy: {mode:'forced'}` to copy streams rather than intentionally re-encode them. This does not guarantee identical metadata, timestamps, or duration; see compatibility findings.
- **Ogg/Opus:** `copy.shiftTolerance: Infinity` handles negative timestamps in initial pre-roll packets.
- **MP4 cover:** a separate Mediabunny read retrieves binary cover bytes.
- **Custom tags:** native ExifTool names for images/MP4, PDF Info keys, MP3 TXXX, and uppercase Vorbis/Matroska keys.
- **WASM memory:** one Worker per engine, released after batch processing, on `pagehide`, or after idle timeout.

</details>

---

## Limitations

- **MP3:** unsupported/non-standard ID3 frames may be lost when writing.
- **MKV:** chapters and attachments are not generally preserved during remuxing.
- **MKV/WebM:** writing is rejected if track count or packet timing cannot be preserved; this includes some audio inputs, variable-duration video, and timestamps beyond the current muxer's preservation capabilities.
- **PDF:** encrypted files are unsupported. Editing a digitally signed PDF invalidates its signature. Malformed/unusual XMP may be rewritten with a warning, potentially losing foreign properties.
- **PNG/WebP:** camera fields are written as XMP (`XMP-tiff:Make/Model`, `XMP-aux:Lens`, `XMP-exif:DateTimeOriginal`), not binary EXIF; EXIF-only readers may not display them.
- **Batch:** ZIP output streams to disk where the File System Access API is supported, with an in-memory fallback. Limits: 10 videos (≤1 hour each, ≤2 GB total), 20 audio files (≤30 minutes each, ≤1 GB total), or 50 images/PDFs (≤1 GB total). Files with unreadable durations are locked.
- **Batch:** files with `failed` integrity are excluded from ZIP output by default; explicitly include them from file details if needed.
- **Batch:** common fields map across format groups; fields not exposed by a target format are skipped. Custom tags remain format-group specific.
- **Ogg:** only Vorbis and Opus are supported; FLAC-in-Ogg and Speex are rejected. External players may not show Ogg/Opus cover art.
- **Covers:** JPEG/PNG/WebP up to 10 MB; GIF/BMP up to 10 MB only for MP3/FLAC/OGG/MKV, not MP4 `covr`.

---

## Development

```bash
# Local server
npm run serve

# Unit tests
npm test

# Browser smoke test (Chrome/Chromium required)
npm run test:e2e

# Bilingual UI, no-reload switching, and offline tests
npm run test:i18n

# Real-fixture compatibility checks using production Workers/adapters
CHROME_BIN=/usr/bin/google-chrome npm run test:compat

# Isolated process per format group; default maximum 2 jobs at once
npm run test:compat -- --concurrency 2
npm run test:compat -- --format mkv,mov

# Regenerate synthetic fixtures; see tests/fixtures/README.md for tools
npm run fixtures:generate

# Update vendor files
npm install && npm run vendor

# Lint
npm run lint
```

### CSS: Modular Sources, One Bundle

`assets/css/app.css` imports modules from `base/`, `components/`, `layout/`, and `pages/`. Import order determines the cascade: do not reorder without testing.

```bash
npm run build:css  # Generate assets/css/app.bundle.css
npm run check:css  # Check that the bundle matches the sources
```

The generated bundle is tracked in Git so deployment needs no build step. Regenerate it whenever CSS sources change; the manifest test and CI reject an outdated bundle.

### Service Worker

- The app shell includes pages, bundled CSS, core modules, Workers, Latin fonts, and small icons.
- Heavy libraries, format adapters, extended fonts, and ExifTool WASM are fetched and cached on demand.
- Navigation uses stale-while-revalidate: cached pages are returned immediately while a network refresh runs in the background.
- A new-version notification offers **Reload** rather than automatically reloading an active editing session.

### Policy Pages

Footer links open **[Privacy Policy](privacy.html)** and **[Terms of Use](Terms.html)** as ID/EN HTML pages with the same theme, header, section navigation, and footer. Both work offline once the app shell is cached. The capital `T` in `Terms.html` is intentional; preserve this spelling on case-sensitive hosting.

Content sources remain `PRIVACY.md` / `PRIVACY-en.md` and `TERMS.md` / `TERMS-en.md`. HTML is generated during development, with no runtime Markdown downloads:

```bash
npm run build:policies
npm run check:policies
```

Regenerate after changing policies or the shared header/footer in `index.html`. Generated HTML is tracked in the repository, with synchronization checked by tests and CI.

### Translation and Compatibility Testing

UI dictionaries live in `assets/js/i18n/`. Keep semantic keys and interpolation parameters aligned between Indonesian and English. Do not translate metadata values, technical format identifiers, or machine-report keys. Language changes must not reset forms or running batch jobs. Language modules are precached; CSS changes still require `npm run build:css`.

See [tests/compat/README.md](tests/compat/README.md) for the browser harness using production `MetadataClient`, Workers, adapters, and WASM. Synthetic fixtures and their generator are documented in [tests/fixtures/README.md](tests/fixtures/README.md).

**Repaired compatibility matrix: 38/38 checks pass across 19 jobs.** The original baseline was 25/33; three Indonesian-text-dependent UI checks later brought it to 22/33 under English defaults. The harness now explicitly tests both UI languages and runs isolated format-group processes, with default concurrency 2. Use `--concurrency 1` for serial execution or `COMPAT_CONCURRENCY=4` on larger machines. Extra load mainly affects RAM/CPU and localhost asset transfer, not internet bandwidth.

Offset relocation requires matching payload hashes; TIFF and MP4/MOV/M4A fixtures also receive independent FFmpeg/ffprobe checks. Complete Ogg picture structures and FLAC vendor metadata are preserved; changed Ogg vendor identity remains a visible warning. The MKV fixture's duration is fixed without widening tolerances. Timing patterns that cannot yet be preserved (including sampled AAC audio-only/audio+video and certain timestamps) are **rejected**, not treated as successful writes. Passing checks include these safe-rejection assertions, not a guarantee every file can be written. See `tests/compat/README.md` for evidence and limitations.

The self-signed PDF fixture is independently validated with OpenSSL and `pdfsig`. Editing retains signature Contents bytes but changes signed-range bytes and invalidates the signature. **Preserving Contents is not preserving cryptographic validity.**

---

## License

**Application code:** [AGPLv3](./LICENSE) — Copyright (C) 2026 mifada2543.

**Source:** [github.com/mifada2543/meinsert](https://github.com/mifada2543/meinsert). Every page also links to Source in its footer.

**Notices:** [NOTICE.md](./NOTICE.md) (Indonesia) · [NOTICE-en.md](./NOTICE-en.md) (English): licensing, third-party attribution, network copyleft, and trademark information.

### Third-Party Attribution

Bundled dependencies retain their own licenses. See the authoritative [attribution index](assets/THIRD_PARTY_LICENSES.md):

- **ExifTool 13.60**, Phil Harvey — Perl Artistic License or GPL; notice in `assets/vendor/licenses/exiftool-LICENSE.txt`.
- **@colorhythm/exiftool-wasm v1.0.5** — Apache-2.0; **zeroperl** runtime — MIT.
- **Mediabunny** — MPL-2.0; **pdf-lib**, **browser-id3-writer**, **fflate** — MIT. Embedded pdf-lib dependencies include pako (MIT AND Zlib), standard-fonts/upng (MIT), and tslib (0BSD).
- **IBM Plex fonts** — SIL Open Font License 1.1; `assets/fonts/OFL.txt`.
- **Brand artwork** — original project assets; [provenance](assets/img/PROVENANCE.md).

Third-party names identify their respective projects and do not imply endorsement.

### Licensing and Monetization

**Commercial use is allowed**, including paid distribution, hosting, support, and premium services. Applicable AGPLv3 obligations remain:

- When conveying covered software, provide Corresponding Source as required by the applicable license provisions.
- If you modify the Program and your version supports remote network interaction, section 13 requires prominently offering remote users an opportunity to receive that version's Corresponding Source at no charge through a standard or customary means.
- Private modifications alone do not require public publication. These duties apply to the covered work, not automatically to independent software used alongside it.
- Third-party components retain their own licenses.

The [LICENSE](./LICENSE) text is binding; this is only a plain-language summary.

### Responsible Use

MeInsert edits metadata such as EXIF, XMP, IPTC, ID3, Vorbis Comment, Matroska tags, and PDF Info. You are responsible for files you edit. Do not remove or forge attribution unlawfully, and comply with local copyright and rights-management laws.

## Usage and Privacy Policies

- **Acceptable Use:** [ID/EN page](Terms.html) · source [Indonesian](TERMS.md) / [English](TERMS-en.md).
- **Privacy Policy:** [ID/EN page](privacy.html) · source [Indonesian](PRIVACY.md) / [English](PRIVACY-en.md).

**The official application does not send or upload file contents, edited metadata,
cover art, or processing outputs to a server.** The privacy policy explains the
local workflow, browser caches/preferences, downloads, and the distinction from
hosting access logs generated when loading the site.

**Forgery for deception or unlawful purposes is prohibited.** Established
violations may result in criminal, civil, and/or administrative penalties under
applicable law and lawful proceedings; MeInsert does not automatically impose
punishment. The use policy does not add restrictions to the AGPL software license.

---

<div align="center">

**MeInsert** — Built for files that should stay private.

_No backend · No uploads · Entirely on your device_

[⬆ Back to top](#meinsert)

</div>
