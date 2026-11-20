<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Limitations and known losses

MeInsert rewrites metadata locally and verifies the result, but some data cannot
be preserved. This page consolidates the caveats from `README.md` /
`README-en.md` ("Limitations") and the findings of the real-file compatibility
harness (`tests/compat/README.md`). These are bounded observations from a
fixture matrix, not a guarantee for every file, codec, chapter, or tag
combination. The integrity report shown after a write is the authoritative
per-file result.

## Global limits

- **File size** — up to 4 GB per file. Larger files are rejected before reading
  (`assets/js/editor/editor-state.js#MAX_FILE_SIZE`, checked in
  `editor/editor-file.js`).
- **Memory** — peak memory is *estimated* (the browser exposes no exact figure).
  `assets/js/core/memory-estimate.js` warns at roughly 350 MB and blocks at
  roughly 900 MB estimated peak. Peak is computed from input + held output +
  cover bytes, a copy factor, and fixed engine overhead; WASM engines run in
  workers and are disposed after batch processing, after ~8 minutes idle, and
  on page close. Actual usage depends on the browser and device.
- **Loss scope** — only requested field changes are written. This is not a
  promise that every unsupported tag survives; review the integrity findings
  after each write. A `failed` integrity result is flagged to the user.
- **Local preferences** — theme, language, quick save, and the one-time policy
  acknowledgment (`meinsert.policyAck`, valid for 30 days) live only in this
  browser's `localStorage`. They are never uploaded, and clearing site data
  resets them (the policy notice then appears again).

## Format-specific caveats

- **MP3** — non-standard / unmapped ID3 frames are lost on write. The old ID3
  tag is replaced; only known `TXXX` custom tags are preserved.
- **MKV / WebM** — chapters and attachments are generally not preserved during
  stream-copy remuxing. Writes are rejected when track count or packet timing
  cannot be preserved (some audio inputs, variable-duration video, and
  timestamps beyond the current muxer's capabilities). Mediabunny 1.65 drops
  `DefaultDuration` on the Matroska copy path; the app restores a constant
  positive default only after scanning for grid-aligned timestamps and then
  re-verifies packet timing. Off-grid, variable-timing, and some AAC
  audio-only/audio+video cases are safely rejected rather than remuxed.
- **PDF** — encrypted PDFs are unsupported. **Editing a digitally signed PDF
  invalidates its signature**: the CMS `Contents` bytes survive but the signed
  byte ranges change. The harness reports this explicitly as `INVALIDATED`; a
  green invariants cell means the warning/preservation assertions passed, not
  that validity was kept. Malformed or unusual XMP is rewritten with a warning
  and foreign properties may be lost in that case.
- **Office (OOXML / ODF)** — supported subtypes: `docx`, `xlsx`, `pptx`, `docm`,
  `xlsm`, `pptm` (OOXML) and `odt`, `ods`, `odp` (ODF). For ODF the `mimetype`
  entry must remain the **first** ZIP entry and **uncompressed (stored)**; this
  is asserted by the preservation suite. **Editing a digitally signed Office
  document invalidates its signature** — a warning is shown in review, but the
  user may still write deliberately. Macro-enabled files (`.docm`, `.xlsm`,
  `.pptm`) keep their macro parts best-effort; running macros is the reader's
  responsibility and is never executed by MeInsert. **Encrypted Office files
  are rejected**, as are legacy binary formats (`.doc`, `.xls`, `.ppt`); only
  the ZIP-based OOXML/ODF subtypes above are supported. Writes rewrite only the
  metadata parts (`docProps/core.xml`, `docProps/app.xml`, `meta.xml`); a
  SHA-256 ZIP-entry check verifies that every other entry is byte-identical,
  and a failed check is surfaced as a `failed` integrity result.
- **Office preview** — the card shown for Office files is a summary of the
  metadata already read (title, creator, available counts, signature/macro
  status). It is deliberately **not** a rendering of the document pages; use a
  document reader if you need to inspect the contents.
- **PNG / WebP** — camera fields are written as XMP (`XMP-tiff:Make/Model`,
  `XMP-aux:Lens`, `XMP-exif:DateTimeOriginal`), not binary EXIF; EXIF-only
  readers may not show them.
- **Ogg** — only Vorbis and Opus are supported; FLAC-in-Ogg and Speex are
  rejected on both read and write. Not all players display Ogg/Opus cover art.
  Ogg `vendor` may be rewritten by Mediabunny (`ENGINE_VENDOR_CHANGED`), an
  explicit warning limited to that format/tag/engine signature; loss of the
  `ENCODER` tag still fails.
- **FLAC / Ogg picture metadata** — native picture blocks/comments are
  preserved rather than regenerated, but the broader fixture matrix (multiple
  picture types, Unicode descriptions, dimensions/depth/colors, back covers) is
  what has been verified; it is not exhaustive for all encoders.
- **MP4 / M4A / MOV cover** — the `covr` atom accepts JPEG/PNG/WebP only; GIF
  and BMP covers are rejected by the picker policy. Cover bytes are read via an
  extra Mediabunny pass because ExifTool WASM cannot return raw binary.
- **Covers (general)** — JPEG/PNG/WebP up to 10 MB for all formats; GIF/BMP up
  to 10 MB for MP3/FLAC/OGG/MKV only (not MP4 `covr`). Some players do not
  display Ogg/Opus covers.

## Batch caveats

- ZIP output streams to disk via the File System Access API where supported
  (Chrome/Edge), with an in-memory fallback elsewhere. Limits: 10 videos
  (≤1 hour each, ≤2 GB total), 20 audio files (≤30 minutes each, ≤1 GB total),
  or 50 images/PDFs (≤1 GB total). Files with unreadable durations are locked.
- Files whose integrity status is `failed` are excluded from ZIP output by
  default; include them explicitly from the file details if needed.
- Common fields map across format groups; fields a target format does not
  expose are skipped. Custom tags remain per format group.

## Compatibility-harness findings (context)

The harness (`tests/compat/README.md`, last verified 2026-11-15) runs 38 cases
across 19 isolated jobs using real files, real Workers/WASM, and the production
integrity engine — no engine or worker mocks. Notable, verified behaviors:

- **TIFF strips / MP4 offsets** — `MEDIA_RELOCATED` is only granted when
  bounded-memory SHA-256 payload proofs match; independent pixel/packet checks
  are also performed. BigTIFF and unsupported structures do not earn the
  exemption.
- **Vorbis picture metadata** — complete native picture comments are kept;
  regenerating lossy dimensions/types is avoided.
- **MOV UserData title** — treated as a title alias, allowed only for an actual
  planned title operation.
- **MKV duration** — preserved only for proven constant packet `DefaultDuration`
  with grid-aligned timestamps; otherwise handled by safe rejection.
- The matrix is explicitly **not proof** for all files/codecs/chapters/foreign
  tags/field combinations, and there is no expected-failure allowlist.
