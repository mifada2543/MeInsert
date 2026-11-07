# THIRD-PARTY LICENSES

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
- **Modifications**: None. Used as distributed.
- **Compliance**: Apache-2.0 §4 — copy of the license is given to
  recipients (`licenses/exiftool-wasm-LICENSE`); modified files (none)
  and copyright/patent/trademark notices from the source are retained
  in the source form of any derivative (none here). The wrapper's
  Apache-2.0 license does **not** override the licenses of the
  components it executes (ExifTool, zeroperl below).

## ExifTool 13.60 — by Phil Harvey (executed inside exiftool-wasm)
- **License**: Same terms as Perl itself — **Perl Artistic License or GPL**
  (see `licenses/exiftool-LICENSE.txt` for the upstream copyright
  statement, reproduced verbatim in substance)
- **Copyright**: 2003-2026, Phil Harvey
- **Source**: https://exiftool.org/ · https://github.com/exiftool/exiftool
- **Where it lives**: Embedded (minified Perl) in
  `assets/vendor/exiftool-wasm/index.js` and executed by the
  `assets/vendor/exiftool-wasm/*.wasm` module via zeroperl.
- **Modifications**: None beyond minification by the upstream
  exiftool-wasm build. The copyright notice above is retained in this
  index and in `licenses/`; the wrapper's Apache-2.0 license grants
  no rights in ExifTool itself.

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
