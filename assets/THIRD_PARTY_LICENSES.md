# Third-party licenses

This project bundles the following third-party libraries in `assets/vendor/`
and fonts in `assets/fonts/`. **This file is the authoritative attribution
index for the bundle.** If any entry below disagrees with the license file
copied into `assets/vendor/licenses/`, the file in `licenses/` controls for
that component; please open an issue so the entry can be corrected.

MeInsert's own code is licensed under **AGPLv3** (see `LICENSE`).
Nothing in this file re-licenses any third-party component.

Product names (ExifTool, Mediabunny, pdf-lib, IBM Plex, zeroperl, …)
are trademarks of their respective owners. They are mentioned here
only to identify the origin of the bundled code; no endorsement or
sponsorship is implied.

## Summary

| Component | Version | License | Role |
|---|---|---|---|
| IBM Plex (Sans, Sans Condensed, Mono) | — | SIL OFL 1.1 | Fonts |
| @colorhythm/exiftool-wasm | 1.0.5 | Apache-2.0 | ExifTool WebAssembly wrapper |
| ExifTool | 13.60 | Perl Artistic License or GPL | Metadata engine (runs inside the wrapper) |
| zeroperl | — | MIT | Perl-in-WASM runtime |
| mediabunny | 1.65.0 | MPL-2.0 | Audio/video demux and mux |
| pdf-lib | 1.17.1 | MIT | PDF metadata |
| brotli | 2.1.0 | MIT (package) and Apache-2.0 (decoder sources) | Brotli decoding on static hosts |
| base64-js | 1.5.1 | MIT | Embedded Brotli dictionary decoding |
| fflate | 0.8.3 | MIT | ZIP / gzip |
| browser-id3-writer | 6.4.0 | MIT | ID3 tags |
| MEeL (adapted source) | commit `95e4937` | AGPL-3.0-or-later | Lyrics/subtitle editor |

The sections below are the authoritative entries.

## IBM Plex (Sans, Sans Condensed, Mono)
- **License**: SIL Open Font License 1.1 (see `assets/fonts/OFL.txt`)
- **Copyright**: © 2017 IBM Corp. with Reserved Font Name "Plex"
- **Source**: https://github.com/IBM/plex
- **Modifications**: Split into latin / latin-ext WOFF2 subsets; IBM Plex Sans is the variable-weight file (wght 100–700). No glyphs modified.
- **Compliance**: OFL permits bundling/redistribution with any software
  provided each copy contains the copyright notice and this license —
  satisfied by `assets/fonts/OFL.txt`. The Reserved Font Name "Plex"
  is retained; the fonts are not sold by themselves.

## @colorhythm/exiftool-wasm v1.0.5
- **License**: Apache-2.0 (see `licenses/exiftool-wasm-LICENSE`)
- **Source**: npm `@colorhythm/exiftool-wasm` — upstream repo
  https://github.com/6over3/exiftool (also published as `@uswriting/exiftool`)
- **Modifications**: The vendored wrapper points to the content-hashed optimized WASM.
- **Compliance**: Apache-2.0 §4 — copy of the license is given to
  recipients (`licenses/exiftool-wasm-LICENSE`); copyright and other
  upstream notices are retained. The wrapper's
  Apache-2.0 license does **not** override the licenses of the
  components it executes (ExifTool, zeroperl below).

## ExifTool 13.60 — by Phil Harvey (executed inside exiftool-wasm)
- **License**: Same terms as Perl itself — **Perl Artistic License or GPL**
  (see `licenses/exiftool-LICENSE.txt` for the upstream copyright
  statement, reproduced verbatim in substance)
- **Copyright**: 2003-2026, Phil Harvey
- **Source**: https://exiftool.org/ · https://github.com/exiftool/exiftool
- **Where it lives**: Embedded (minified Perl) in
  the zeroperl WASM module served as `.wasm.gz` or `.wasm.br`.
- **Modifications**: MeInsert prunes optional format modules and POD and adjusts
  TagLookup to skip unavailable tables. See `scripts/optimize-exiftool.mjs`.
  The upstream ExifTool license remains applicable.

## zeroperl (Perl-in-WASM runtime, executed inside exiftool-wasm)
- **License**: MIT (see `licenses/zeroperl-LICENSE`)
- **Copyright**: © 2025 United States Writing Corporation
- **Source**: https://github.com/6over3/zeroperl
- **Where it lives**: WebAssembly engine in
  `assets/vendor/exiftool-wasm/*.wasm`; it provides the WASI/asyncify
  runtime that evaluates ExifTool Perl in the browser.
- **Modifications**: None. Used as distributed via exiftool-wasm.

## mediabunny v1.65.0
- **License**: MPL-2.0 (see `licenses/mediabunny-LICENSE`)
- **Source**: https://github.com/Vanilagy/mediabunny
- **Modifications**: None. Used as distributed (minified ESM bundle).
- **Compliance**: MPL-2.0 is a weak (file-level) copyleft license.
  The bundled `.mjs` is an unmodified Executable Form; the
  Corresponding Source remains available from the upstream repo
  above at no charge.

## pdf-lib v1.17.1
- **License**: MIT (see `licenses/pdf-lib-LICENSE.md`)
- **Copyright**: © 2019 Andrew Dillon
- **Source**: https://github.com/Hopding/pdf-lib
- **Modifications**: None. Used as distributed (minified ESM bundle).
- **Embedded transitive dependencies**: `pako` (MIT AND Zlib),
  `@pdf-lib/standard-fonts` (MIT), `@pdf-lib/upng` (MIT), `tslib`
  (0BSD) — see `licenses/pdf-lib-dependencies-LICENSES.md` for
  SPDX identifiers, upstream URLs, and notes. `licenses/package.json`
  is pdf-lib's package metadata, retained for provenance; it is not
  a license.

## fflate v0.8.3
- **License**: MIT (see `licenses/fflate-LICENSE`)
- **Source**: https://github.com/101arrowz/fflate
- **Modifications**: None. Used as distributed (browser ESM bundle).

## browser-id3-writer v6.4.0
- **License**: MIT (see `licenses/browser-id3-writer-LICENSE.md`)
- **Copyright**: © @egoroof
- **Source**: https://github.com/egoroof/browser-id3-writer
- **Modifications**: None. Used as distributed.
- **Note**: The upstream repository is `egoroof/browser-id3-writer`;
  no other organisation is the rights holder for the bundled copy.

## MEeL — LRC editor & timed-text helpers (adapted source)
- **License**: AGPL-3.0-or-later (see `licenses/meel-LICENSE`)
- **Copyright**: © 2026 Mifada (mifada2543)
- **Source**: https://github.com/mifada2543/MEeL-HUB — pinned at commit
  `95e4937c74c3929977a907a463a415dcea50d2da` (files last changed in `8e64b9f`)
- **Files used**: `assets/js/music/lrc-editor.js`,
  `assets/css/music/lrc-editor.css`, `assets/js/music/watch/karaoke.js`,
  `modules/core/helpers/lyrics.php`, `modules/core/helpers/subtitle.php`
- **Where it lives in MeInsert**: `assets/js/core/timed-text.js`,
  `assets/js/ui/timed-text-editor.js`, `assets/css/components/timed-text-editor.css`
- **Modifications**: ported from PHP/IIFE to plain ESM with millisecond-based
  state; PHP/database/lucide/plyr/htmx dependencies removed; `localStorage`
  replaced by MeInsert editor state; media preview from `URL.createObjectURL`;
  design tokens and mobile bottom-sheet restyled for MeInsert; AGPL header and
  MeInsert watermark added. The original editor displays karaoke lyrics while
  playing; MeInsert reuses its timestamp parsing, tap-to-mark, active-line
  sync (0.15 s tolerance) and centred auto-scroll.
- **Compliance**: same author and license family as MeInsert (AGPLv3). This
  attribution, the copied license text, and per-file source headers are kept
  so recipients can identify the adapted code and its origin. No endorsement
  by MEeL is implied.

---

All license texts are included in the `assets/vendor/licenses/`
directory (plus `assets/fonts/OFL.txt` for the fonts). The
attributions above satisfy the license requirements for redistribution.

## If you re-vendor

`scripts/vendor.mjs` copies the pinned bundles from `node_modules`.
After running it, re-check that every file in `assets/vendor/licenses/`
still matches its upstream license, and keep this index in sync —
in particular the ExifTool notice, which is **not** copied by the
script and must survive `npm run vendor`.


## Brotli decoder and base64-js
- **Source**: npm `brotli@2.1.0` (https://github.com/devongovett/brotli.js),
  and `base64-js@1.5.1` (https://github.com/beatgammit/base64-js).
- **License**: The Brotli package declares MIT. The decoder sources include
  Copyright 2013 Google Inc. and Apache-2.0 notices (license text in
  `licenses/exiftool-wasm-LICENSE`). base64-js is MIT
  (`licenses/base64-js-LICENSE`).
- **Modifications**: Bundled and minified the decoder entry and dependencies
  into `assets/vendor/brotli-decode.mjs`.
