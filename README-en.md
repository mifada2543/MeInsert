<div align="center">

<img src="assets/img/icon-512.webp" alt="MeInsert" width="120" height="120" />

# MeInsert

[🇮🇩 Indonesia](README.md) · **🇬🇧 English**

**Edit metadata without uploading — entirely in your browser**

Read and write image, PDF, audio, and video metadata directly on your device.
No backend. No uploads. No account.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_Now-2ea44f?style=for-the-badge)](https://meinsert.my.id/)
[![PWA](https://img.shields.io/badge/PWA-Installable-7B3FF2?style=for-the-badge)](https://meinsert.my.id/)
[![Offline](https://img.shields.io/badge/Offline-Ready-10b981?style=for-the-badge)](https://meinsert.my.id/)
[![CI](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml/badge.svg)](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml)

[![Version](https://img.shields.io/badge/version-v1.3.0-blue?style=for-the-badge)](./package.json)
[![License](https://img.shields.io/badge/License-AGPLv3-orange?style=for-the-badge)](./LICENSE)
[![Client-side](https://img.shields.io/badge/100%25_Client--side-lightgrey?style=for-the-badge)]()
[![No Build](https://img.shields.io/badge/Static-No%20Build-purple?style=for-the-badge)]()

![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-624DE3?style=flat-square)
![Service Worker](https://img.shields.io/badge/Service_Worker-PWA-61DAFB?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square)

![Preview](assets/img/og-image.jpg)

</div>

## Quick start in 30 seconds

Pick one of these three needs — all of them run in your browser, with no account:

| Need | Open | Status |
|---|---|---|
| ✏️ Edit **one file**'s metadata | [Single-file editor](https://meinsert.my.id/single.html) | Available |
| 📦 Edit **many files** at once, plus ZIP and reports | [Batch mode](https://meinsert.my.id/batch.html) | Available |
| 🧹 **Clean metadata** from files | [Clean metadata](https://meinsert.my.id/index.html?clean=1) | Available — remove sensitive GPS/EXIF data or pick tags per category |

[🚀 Try the live demo](https://meinsert.my.id/) · [📄 Single file](./single.html) · [📦 Batch](./batch.html) · [🧹 Clean metadata](./index.html?clean=1) · [⚙️ Installation](#quick-installation-xampp)

---

## Contents

- [Why MeInsert?](#why-meinsert)
- [Supported formats](#supported-formats)
- [How to use](#how-to-use)
- [Key features](#key-features)
- [Interface language](#interface-language)
- [Quick installation (XAMPP)](#quick-installation-xampp)
- [How to verify the local-only claim](#how-to-verify-the-local-only-claim)
- [Further documentation](#further-documentation)
- [Development](#development)
- [License](#license)
- [Usage and privacy policies](#usage-and-privacy-policies)

---

## Why MeInsert?

| 🔒 Local Processing | ⚡ Lightweight Deployment | 📴 Offline Support |
|---|---|---|
| Files are read and written in the browser using WASM and Workers. No file uploads. | Static files: no backend or deployment build step. Runs directly on XAMPP/Apache. | The app shell works offline after caching completes. Format engines and WASM work offline after they have been loaded. |

**Three needs, one principle:** edit a single file, process many files by format group, or clean metadata. **Clean metadata** is available now — choose the Privacy profile, remove everything safe, or pick categories yourself. Results are still reviewed and verified as usual.

---

## Supported formats

Formats are detected from the **file contents**, not just the extension — a wrongly named file is still read correctly. Only the relevant fields are shown. Technical details live in the [limitations documentation](docs/LIMITATIONS.md).

| Category | Formats | Writing Method |
|---|---|---|
| 🖼️ **Images** | JPEG, PNG, WebP, TIFF | XMP + EXIF; IPTC for JPEG/TIFF |
| 📄 **PDF** | PDF | Info Dictionary + XMP stream |
| 🎵 **Audio** | MP3, FLAC, OGG Vorbis / Opus | ID3v2.3, Vorbis Comment; stream-copy remuxing |
| 🎬 **Video** | MP4 / M4A / MOV, MKV / WebM | ItemList + XMP through ExifTool; Matroska SimpleTag with stream-copy remuxing |
| 📑 **Office** | DOCX, XLSX, PPTX, ODT, ODS, ODP | Patches only the metadata XML parts; all other ZIP entries are verified byte-for-byte |

### Cover art / thumbnails

Embed JPEG/PNG/WebP covers up to 10 MB. GIF/BMP covers are also supported for MP3, FLAC, OGG/Opus, and MKV. Covers use native structures: MP3 `APIC`, FLAC/OGG/Opus `METADATA_BLOCK_PICTURE`, MP4/M4A `covr` (JPEG/PNG/WebP only), and Matroska attachments for MKV/WebM. Covers can be replaced or removed. Details and limits are in the [limitations documentation](docs/LIMITATIONS.md).

### Synchronized lyrics & subtitles

The **Lyrics & subtitles** button opens a two-column editor: media preview on the left and the line list on the right (video uses a forced landscape layout). You can type, timestamp each line directly, import (`.lrc`, `.srt`, `.vtt`) and export timed text. The preview uses your local media (`blob:`) with no upload.

The **gear** button opens a floating **Text appearance** card for text colour, background colour/opacity, size, bold, shadow, position and alignment, including a **MEeL** preset. While the card is open the editor dims and the primary button becomes **Save preference** (storing the preference in `localStorage`); when closed it returns to **Apply**. Clicking outside the card or pressing the gear ✕ closes settings; unsaved changes prompt **Discard** / **Save**. Line drafts are saved automatically and cleared after **Apply**.

On save, the text is embedded inside the container: `SYLT` for MP3, a `LYRICS` comment for FLAC/OGG/Opus, `©lyr` plus a WebVTT track for MP4/M4A, and a WebVTT track for MKV/WebM. Lyrics can also become a track labelled "Lirik". The `STYLE` block and cue settings are written too; colours and backgrounds are guaranteed in the preview and `.vtt` file, while internal players may differ. The original file is never overwritten. Details and limits are in the [limitations documentation](docs/LIMITATIONS.md).

### Office documents

- **Fully supported:** DOCX, XLSX, PPTX, as well as ODT, ODS, ODP.
- **Best-effort:** macro-enabled variants `.docm`, `.xlsm`, `.pptm`. Macros are preserved byte-for-byte, but verify the output after saving.
- **Signatures:** editing metadata in a signed Office document invalidates its signature.
- **Unsupported:** encrypted Office files and legacy `.doc`, `.xls`, `.ppt` formats.
- Every Office write patches only the metadata XML parts and verifies all other ZIP entries byte-for-byte.

---

## How to use

### 1. Choose a File

Open the home page and select **Single file** for individual editing or **Batch** for multiple files.

### 2. Edit Metadata

Fields appear according to the format. Change the fields you need, add **custom tags**, replace cover art, or clear fields to remove tags.

### 3. Save and Download

Select **Save**, review the changes, and confirm. The output is read again and verified before downloading a new file or batch ZIP. The original file is never overwritten.

> **Change tracking:** only requested field changes are submitted for writing. This does not guarantee preservation of every unsupported tag. The output extension follows detected content by default; the mismatch review dialog also offers an explicit option to keep the original extension. Renaming a file does not convert its format.

---

## Key features

### Single file vs batch

| | Single File | Batch |
|---|---|---|
| Limits | Up to 4 GB per file | Up to 10 video files, 20 audio files, or 50 images/PDFs |
| Editing | Format-specific fields, custom tags, searchable raw table | Format groups or shared cross-format fields, file selection, per-file raw tags |
| Output | Verified file with controlled naming | ZIP + JSON/CSV reports |

### More features

- **Review before writing** — inspect changed fields, custom tags, raw tags, and covers. No-op changes are omitted.
- **Automatic verification** — output is read again and metadata outside the change plan is compared before and after.
- **Custom and raw tags** — add non-standard metadata per format and search raw tags quickly.
- **Undo/redo** — available in the single-file editor and, separately, per format group in batch mode.
- **Light/dark theme** — follows the system or a manual preference, with no flash on load.
- **Installable PWA** — install from the browser menu; the app shell and format dependencies work offline after first load.
- **Continuous media preview** — changing a thumbnail or discarding changes does not stop audio/video preview.
- **About page** — a short summary of principles, supported formats, and policy links; no need to read the full documents first.
- **One-time policy notice** — just click **Got it**; the choice is saved in your browser for 30 days.
- **Storage & Offline settings** — choose *Frugal* (default), *Mostly ready*, or *Download everything*. Frugal mode is forced automatically when the browser enables Save-Data.
- **Comfortable on small screens** — theme, language, and settings move into the ☰ menu (which turns into ✕ when open); primary actions stay visible, secondary controls live in the **Options** panel.
- **Animated preview open/close** — smooth, keeps media playing, and respects the system's reduced-motion setting.
- **Office document preview** — a summary card built from document metadata (title, creator, counts, signature/macro status) helps you confirm you picked the right file. A bounded content excerpt is available when present; it is not a full-fidelity rendering.

---

## Interface language

Select **ID** (Indonesian) or **EN** (English) in the header of the home, single-file, or batch page. On small screens (≤700px), the toggle lives in the ☰ menu together with the theme button and **Storage & Offline**.

- The preference is stored locally under `meinsert-language`.
- Without a saved preference, the Indonesian/English browser language is used; other languages fall back to Indonesian.
- Switching language does not reload the page or change files, metadata values, or JSON/CSV report schemas.
- Documentation: **[Indonesian](README.md)** · **[English](README-en.md)**.

---

## Quick installation (XAMPP)

No deployment build is needed. HTML/CSS/JS and vendor files are included in the repository.

```bash
# 1. Put a copy in your XAMPP htdocs folder, then open it in the browser
git clone https://github.com/mifada2543/meinsert.git MeInsert
# http://localhost/MeInsert/
```

You do **not** need `npm install` to use the app — vendor libraries are included in the repository. `npm install` and `npm run vendor` are only for **development** or when upgrading libraries (see CONTRIBUTING.md).

Use your browser's **Install / Add to Home Screen** action to install the PWA.

> Stay online until the browser finishes caching the pages and main assets. Then the pages can open offline. Vendor libraries and ExifTool WASM (~27 MB) are fetched and cached on first use. In **Storage & Offline** you can choose Frugal, Mostly ready, or Download everything.

Run a local server without XAMPP:

```bash
npm run serve  # http://localhost:8000
```

Hosting note: `.htaccess` is for Apache/XAMPP, `_headers` is for Netlify/Cloudflare Pages, and GitHub Pages ignores both — see the [deployment guide](docs/deployment.md).

---

## How to verify the local-only claim

Open DevTools → **Network**, then open a file → edit → save. There should be **no requests to any other address** — everything happens in your browser. After the first visit, switch on airplane mode: the pages and editor still work. The Content Security Policy blocks outgoing requests too, so this check is more than a promise.

Full guide plus a note about the production host's analytics beacon: **[docs/security.md](docs/security.md)**. Automated check: `node tests/e2e/security.mjs`.

---

## Further documentation

Technical depth was moved out of this README to keep it short:

- **[Architecture and project layout](docs/ARCHITECTURE.md)** — workflow, modules, workers, and WASM.
- **[Limitations and compatibility findings](docs/LIMITATIONS.md)** — per-format limits, verification, and harness evidence.
- **[Verifying the local-only claim](docs/security.md)** — DevTools, airplane mode, and CSP.
- **[Deployment and hosting headers](docs/deployment.md)** — `.htaccess`, `_headers`, GitHub Pages, and `/sw.js` caching.
- **[About page](about.html)** — a quick explanation for new users.
- **[Launch notes](docs/launch-notes.md)** — release summary.

---

## Development

```bash
npm run serve            # local server http://localhost:8000
npm run test:fast        # fast gate: unit + lint + CSS + policy (~3s, no browser)
npm test                 # 372 unit tests
npm run lint             # ESLint
npm run check:css        # CSS bundle matches its sources
npm run check:policies   # policy pages match their Markdown sources
npm run test:e2e         # browser smoke test (1 suite)
npm run test:e2e:all     # all 18 E2E suites in one shared Chrome process (CDP)
# CI shards suites across 4 runners: MEINSERT_E2E_SHARD=1/4 npm run test:e2e:all
npm run test:preview     # preview open/close animation
npm run test:action-bar  # action bar & Options panel
npm run test:about       # About page and mobile menu
npm run test:offline     # Storage & Offline settings
npm run test:reveal      # scroll-reveal animation
npm run test:i18n        # bilingual UI and offline
npm run test:undo        # single-file undo/redo
npm run test:undo:batch  # batch undo/redo
npm run test:security    # CSP and network audit
npm run test:engine      # WASM engine download and status
npm run test:wasm-integrity # WASM E2E with an active Service Worker
npm run test:timed-text  # lyrics/subtitle editor and appearance preferences
npm run test:quick-save  # quick save
npm run test:clean       # clean metadata (single and batch)
npm run test:office      # OOXML/ODF documents
npm run test:compat      # 48 compatibility cases with real fixtures
npm run build:css        # regenerate app.bundle.css
npm run build:policies   # regenerate policy pages from Markdown
```

---

## License

**Application code:** [AGPLv3](./LICENSE) — Copyright (C) 2026 mifada2543.

**Source:** [https://github.com/mifada2543/meinsert](https://github.com/mifada2543/meinsert). Every page also links to Source in its footer.

**Notices:** [NOTICE.md](./NOTICE.md) (Indonesian) · [NOTICE-en.md](./NOTICE-en.md) (English).

### Third-party attribution

Bundled dependencies retain their own licenses. See the [attribution index](assets/THIRD_PARTY_LICENSES.md):

- **ExifTool 13.60** (Artistic/GPL), **@colorhythm/exiftool-wasm** (Apache-2.0) + **zeroperl** (MIT)
- **Mediabunny** (MPL-2.0), **pdf-lib**, **browser-id3-writer**, **fflate** (MIT)
- **IBM Plex fonts** — SIL Open Font License 1.1
- **MEeL — LRC editor & timed-text helpers** (AGPL-3.0, © 2026 Mifada) — adapted source for the lyrics/subtitle editor; the exact source and destination files are listed in [NOTICE-en.md](./NOTICE-en.md) and the [attribution index](assets/THIRD_PARTY_LICENSES.md).
- **Brand artwork** — original project assets; [provenance](assets/img/PROVENANCE.md)

### Licensing and monetization (AGPLv3)

Commercial use is allowed, but AGPLv3 is *network copyleft*: when conveying covered software, provide the **Corresponding Source**. Private modifications do not automatically require publication. The [LICENSE](./LICENSE) text is binding; this is only a plain-language summary.

### Responsible use

MeInsert only provides a *tool* for reading and writing standard tags. You are responsible for files you edit: do not remove or forge copyright attribution, and comply with local law.

---

## Usage and privacy policies

- **Acceptable Use:** [ID/EN page](Terms.html) · source [Indonesian](TERMS.md) / [English](TERMS-en.md).
- **Privacy Policy:** [ID/EN page](privacy.html) · source [Indonesian](PRIVACY.md) / [English](PRIVACY-en.md).
- **Security:** [SECURITY.md](SECURITY.md) · [security.txt](.well-known/security.txt).

**The official application does not send or upload file contents, edited metadata,
cover art, or processing outputs to a server.** See [docs/security.md](docs/security.md) for how to verify this claim, including a note about the analytics beacon injected by the production host.

**Forgery for deception or unlawful purposes is prohibited.** Established violations may result in penalties under applicable law and lawful proceedings; MeInsert does not automatically impose punishment. The use policy does not add restrictions to the AGPL software license.

---

<div align="center">

**MeInsert** — Built for files that should stay private.

_No backend · No uploads · Entirely on your device_

[⬆ Back to top](#meinsert)

</div>
