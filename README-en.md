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

[![Version](https://img.shields.io/badge/version-v1.3.0-blue?style=for-the-badge)](./package.json)
[![License](https://img.shields.io/badge/License-AGPLv3-orange?style=for-the-badge)](./LICENSE)
[![Client-side](https://img.shields.io/badge/100%25_Client--side-lightgrey?style=for-the-badge)]()
[![No Build](https://img.shields.io/badge/Static-No%20Build-purple?style=for-the-badge)]()

![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-624DE3?style=flat-square)
![Service Worker](https://img.shields.io/badge/Service_Worker-PWA-61DAFB?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square)

![Preview](assets/img/og-image.png)

</div>

## Quick start in 30 seconds

Pick one of these three needs — all of them run in your browser, with no account:

| Need | Open | Status |
|---|---|---|
| ✏️ Edit **one file**'s metadata | [Single-file editor](https://meinsert.my.id/single.html) | Available |
| 📦 Edit **many files** at once, plus ZIP and reports | [Batch mode](https://meinsert.my.id/batch.html) | Available |
| 🧹 **Clean metadata** from files | — | **Coming** — planned for v1.3 Fase 3 |

[🚀 Try the live demo](https://meinsert.my.id/) · [📄 Single file](./single.html) · [📦 Batch](./batch.html) · [⚙️ Installation](#quick-installation-xampp)

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

**Two modes available today, one principle:** single-file editing for one file, and batch for format-group processing. The **clean metadata** mode is planned (v1.3 Fase 3).

---

## Supported formats

Automatic detection uses **magic bytes**, not just filename extensions. Only the relevant fields for the detected format are displayed.

| Category | Formats | Writing Method |
|---|---|---|
| 🖼️ **Images** | JPEG, PNG, WebP, TIFF | XMP + EXIF; IPTC for JPEG/TIFF |
| 📄 **PDF** | PDF | Info Dictionary + XMP stream |
| 🎵 **Audio** | MP3, FLAC, OGG Vorbis / Opus | ID3v2.3, Vorbis Comment; stream-copy remuxing |
| 🎬 **Video** | MP4 / M4A / MOV, MKV / WebM | ItemList + XMP through ExifTool; Matroska SimpleTag with stream-copy remuxing |
| 📑 **Office** | DOCX, XLSX, PPTX, ODT, ODS, ODP | Patches only the metadata XML parts; all other ZIP entries are verified byte-for-byte |

### Cover art / thumbnails

Embed JPEG/PNG/WebP covers up to 10 MB. GIF/BMP covers are also supported for MP3, FLAC, OGG/Opus, and MKV. Covers use native structures: MP3 `APIC`, FLAC/OGG/Opus `METADATA_BLOCK_PICTURE`, MP4/M4A `covr` (JPEG/PNG/WebP only), and Matroska attachments for MKV/WebM. Covers can be replaced or removed. Details and limits are in the [limitations documentation](docs/LIMITATIONS.md).

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

---

## Interface language

Select **ID** (Indonesian) or **EN** (English) beside the theme button on the home, single-file, or batch page.

- The preference is stored locally under `meinsert-language`.
- Without a saved preference, the Indonesian/English browser language is used; other languages fall back to Indonesian.
- Switching language does not reload the page or change files, metadata values, or JSON/CSV report schemas.
- Documentation: **[Indonesian](README.md)** · **[English](README-en.md)**.

---

## Quick installation (XAMPP)

No deployment build is needed. HTML/CSS/JS and vendor files are included in the repository.

```bash
# 1. Clone into htdocs
cd /opt/lampp/htdocs
git clone https://github.com/mifada2543/meinsert.git MeInsert
cd MeInsert

# 2. Development dependencies / vendor updates (once, or when updating libraries)
npm install
npm run vendor

# 3. Open in your browser
# http://localhost/MeInsert/
# Use Install / Add to Home Screen for the PWA
```

> Stay online until the service worker finishes caching the app shell. Then the pages can open offline. Vendor libraries and ExifTool WASM (~27 MB) are fetched and cached on first use.

Run a local server without XAMPP:

```bash
npm run serve  # http://localhost:8000
```

Hosting note: `.htaccess` is for Apache/XAMPP, `_headers` is for Netlify/Cloudflare Pages, and GitHub Pages ignores both — see the [deployment guide](docs/deployment.md).

---

## How to verify the local-only claim

Open DevTools → **Network**, then run open → edit → save: only same-origin requests may appear. After the first visit, airplane mode still works. The `connect-src 'self'` CSP makes requests to any other origin impossible by policy.

Full guide plus a note about the production host's analytics beacon: **[docs/security.md](docs/security.md)**. Automated check: `node tests/e2e/security.mjs`.

---

## Further documentation

Technical depth was moved out of this README to keep it short:

- **[Architecture and project layout](docs/ARCHITECTURE.md)** — workflow, modules, workers, and WASM.
- **[Limitations and compatibility findings](docs/LIMITATIONS.md)** — per-format limits, verification, and harness evidence.
- **[Verifying the local-only claim](docs/security.md)** — DevTools, airplane mode, and CSP.
- **[Deployment and hosting headers](docs/deployment.md)** — `.htaccess`, `_headers`, GitHub Pages, and `/sw.js` caching.
- **[Launch notes](docs/launch-notes.md)** — release summary.

---

## Development

```bash
npm run serve            # local server http://localhost:8000
npm test                 # unit tests
npm run test:e2e         # browser smoke test
npm run test:i18n        # bilingual UI and offline
npm run test:undo        # single-file undo/redo
npm run test:undo:batch  # batch undo/redo
node tests/e2e/security.mjs  # CSP and network audit
npm run test:compat      # compatibility harness with real fixtures
npm run lint             # ESLint
npm run build:css        # regenerate app.bundle.css
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
