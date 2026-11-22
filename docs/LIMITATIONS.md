<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Limitations and known losses

> **Short version:** MeInsert verifies every write, but it cannot promise that
> every unsupported tag, signature, or container feature survives. The integrity
> report shown after saving is the authoritative result for each file.

## Contents

- [Global limits](#global-limits)
- [Timed text (lyrics & subtitles)](#timed-text-lyrics--subtitles)
- [Cut audio/video](#cut-audiovideo)
- [Format-specific caveats](#format-specific-caveats)
- [Batch caveats](#batch-caveats)
- [Compatibility-harness findings](#compatibility-harness-findings-context)

MeInsert rewrites metadata locally and verifies the result, but some data cannot
be preserved. This page consolidates the caveats summarized in the "Keterbatasan" /
"Limitations" sections of [`README.md`](../README.md) /
[`README-en.md`](../README-en.md) and the findings of the real-file compatibility
harness (`tests/compat/README.md`). These are bounded observations from a
fixture matrix, not a guarantee for every file, codec, chapter, or tag
combination.

## Global limits

- **File size** — up to 4 GB per file. Larger files are rejected before reading
  (`assets/js/editor/editor-state.js#MAX_FILE_SIZE`, checked in
  `editor/editor-file.js`).
- **Memory** — peak memory is *estimated* (the browser exposes no exact figure).
  `assets/js/core/memory-estimate.js` warns at roughly 350 MB and blocks at
  roughly 900 MB estimated peak. Peak is computed from input + held output +
  cover bytes, a copy factor, and fixed engine overhead; WASM engines run in
  workers and are disposed after batch processing, after ~8 minutes idle, and
  on page close. Actual usage depends on the browser and device. The `?mem=1`
  query flag records the largest worker message/result payloads so the estimate
  can use an observed peak; it does not change processing. Payload buffers sent
  to workers are transferred rather than copied twice. The batch review dialog
  suggests the existing low-memory mode automatically when the peak reaches the
  warning/block band. A `block` classification is now enforced on every save
  path: processing is disabled until low-memory mode (batch) or an explicit risk
  acknowledgement (single file) is selected; quick-save cannot bypass it. `warn`
  remains a dismissible warning. The estimated payload size is not a measurement
  of browser JS heap or RSS.
- **Loss scope** — only requested field changes are written. This is not a
  promise that every unsupported tag survives; review the integrity findings
  after each write. A `failed` integrity result is flagged to the user.
- **Local preferences** — theme, language, quick save, and the one-time policy
  acknowledgment (`meinsert.policyAck`, valid for 30 days) live only in this
  browser's `localStorage`. They are never uploaded, and clearing site data
  resets them (the policy notice then appears again).
- **Change history** — the change-history panel can roll the editor back to an
  earlier entry, and the rollback itself is undoable with **Undo** (Ctrl+Z).
  The history lives only in the current editor session: reloading the page or
  opening another file clears it, and it never contains a previously saved file.

## Timed text (lyrics & subtitles)

- Lyrics and subtitles are embedded **inside the container**, never burned into
  the video pixels. This grows the file slightly; the size delta is shown in
  the review dialog before saving.
- **MP3** timed lyrics use ID3v2 `SYLT` (millisecond timestamps). An existing
  `SYLT` frame is preserved when you edit other fields.
- **FLAC / OGG / Opus** store timed lyrics as a `LYRICS` Vorbis comment using
  LRC syntax; the plain-text lyrics field and the timed track stay in sync.
- **MP4 / M4A** store the plain lyrics in `©lyr` and place WebVTT cues in a
  `wvtt` subtitle track. Browser-native `<video>` cannot render `wvtt`; use a
  player that supports WebVTT in MP4, or export a `.vtt` sidecar.
- **MKV / WebM** place WebVTT cues in an `S_TEXT/WEBVTT` subtitle track. The
  engine copies existing A/V packets without re-encoding, and verifies their
  hashes before releasing the result.
- The engine cannot read cues back from an embedded subtitle track (mediabunny
  demuxes video/audio only). On reload, the lyric field is recovered from
  `LYRICS`, but subtitle cues must be re-imported from a `.vtt` file.
- Only one language per track is supported in this version.
- Text colour, background colour/opacity, size, bold/shadow, position and
  alignment are editable in the **Text appearance** panel, which is offered only
  for video subtitles: LRC lyrics carry no colour/background format. They are
  applied exactly to the in-editor preview and to exported `.vtt` files. The same
  `STYLE` block and cue settings are written into the embedded WebVTT track, but
  player support varies: MKV/WebVTT players such as mpv/VLC usually honour them,
  while MP4 `wvtt` and browser-native players may ignore colours and
  backgrounds. Position/alignment settings are the most widely supported.
- Appearance preferences are stored in `localStorage` separately from the
  line draft. The draft is cleared when you press **Apply**. The preference
  card is compact and keeps the `+ Line` / gear / `Show: Subtitle` toolbar
  visible; it stays in the right-hand editor pane rather than becoming a
  separate centered dialog.

## Cut audio/video

The trim dialog stages a `{ start, end, mode }` range in editor state; the cut
itself happens on save. The result is verified by the integrity report, which
is authoritative for each file. These are the known caveats:

- **Keyframe boundaries (copy mode)** — copy mode is stream-copy where the
  container allows it and does not re-encode by default. Cut points may snap to
  the nearest usable keyframe/packet boundary, so the retained range can differ
  slightly from the requested one; `conversionCutOptions()` uses
  `boundaryPolicy: 'shrink'` to avoid extending past the requested end.
- **Transcoding (precise mode)** — precise mode requests exact boundaries and
  may transcode the media. Quality, bitrate, encoding time and file size can
  change, and some codec/container combinations are refused rather than
  silently mangled.
- **Chapters and attachments** — chapter tracks, attachments, and other
  non-A/V structures are generally not preserved by stream-copy remuxing of
  MKV/WebM/MP4; ID3 chapter frames (`CHAP`/`CTOC`) in MP3 need the same care.
- **Xing/TLEN/CHAP/CTOC** — MP3 frame slicing copies ID3v2 bytes verbatim, but
  the Xing/Info header of the first frame is dropped when a cut does not start
  at zero (it describes the original full stream). Downstream `TLEN` duration
  values and chapter/table-of-contents entries can become stale and should be
  re-read after saving.
- **Memory** — the cut engine holds the selected encoded packets and the output
  blob in memory. Large audio/video files can exceed the estimated warning
  (~350 MB) or block (~900 MB) bands. Peak is estimated, not measured; the
  same `warn`/`block` policy as other writes applies (low-memory mode for
  batches, explicit risk acknowledgement for a single file). Worker payloads
  are transferred rather than duplicated.
- **Offline** — cutting needs the optional engine assets. Offline use is
  blocked with a toast unless the `audio` package (for audio) or `image`
  package (for video) has already been downloaded in Settings → Storage &
  Offline.

## Format-specific caveats

### HEIC/HEIF

- Metadata is written to **XMP on a best-effort basis**. The HEIF container and
  its encoded pixels are not rewritten, so EXIF-only readers may not show the
  fields. Unsupported tags are not guaranteed to survive.
- The preview is a **placeholder**: browsers do not decode HEIC/HEIF natively.
  It identifies the file type; it is not a rendering of the photo.
- The output is read back and verified like other image files, but the
  best-effort XMP path reports findings you should review before downloading.

### RAW images

- Supported still-RAW subtypes: DNG, CR2, CR3, NEF, ARW, ORF, RW2, RAF.
- **XMP-only, best-effort**: only the XMP packet is patched. Binary EXIF, maker
  notes, and raw sensor data are never decoded or modified; EXIF-only readers
  may not show the fields.
- The preview is a **placeholder** because there is no raw decoder in the
  browser. It does not represent the actual image.
- **Chapters and offsets:** CinemaDNG inside MOV/MKV is not handled here. Those
  files keep using the `mp4`/`mkv` adapters and inherit their chapter and
  container-offset caveats.

### RAW video

- Supported subtypes: BRAW, R3D, ARRIRAW.
- **Read-only**: metadata can be inspected, but there is no write path. The
  **save guard** rejects any attempt to export or overwrite these files, so the
  original is never touched.
- The preview is a **placeholder**; compressed raw frames are not decoded or
  rendered.
- **Chapters and offsets:** these containers can carry timecode, chapter, or
  byte-offset metadata that MeInsert may read but cannot preserve or rewrite.
  Treat the read view as partial, not as a complete map of the file.

### MP3

- ID3v2.3/v2.4 tags are patched surgically (`core/id3-passthrough.js`): frames
  that are not edited are copied byte-for-byte, including unknown/binary frames
  such as `PRIV`, `CHAP` and `CTOC`. Editing is operation-aware: an edit to
  `TIT2` writes only `TIT2`, so unrelated `COMM`, `APIC` and `TXXX` frames are
  never rebuilt. Multiple instances are distinguished by description/language
  (`COMM`, `USLT`, `TXXX`) or MIME/type/description (`APIC`); editing or removing
  a cover/comment targets only the primary instance and keeps the others.
- ID3v2.2 tags and malformed tags cannot be patched safely; MeInsert falls back
  to a full tag rewrite and warns that unknown frames may be lost.

### MKV / WebM

- Chapters and attachments are generally not preserved during stream-copy
  remuxing.
- Writes are rejected when track count or packet timing cannot be preserved
  (some audio inputs, variable-duration video, and timestamps beyond the current
  muxer's capabilities).
- Mediabunny 1.65 drops `DefaultDuration` on the Matroska copy path. The app
  restores a constant positive default only after scanning for grid-aligned
  timestamps, and then re-verifies packet timing.
- Off-grid, variable-timing, and some AAC audio-only/audio+video cases are
  safely rejected rather than remuxed.

### PDF

- Encrypted PDFs are unsupported.
- **Editing a digitally signed PDF invalidates its signature**: the CMS
  `Contents` bytes survive but the signed byte ranges change. The harness reports
  this explicitly as `INVALIDATED`; a green invariants cell means the
  warning/preservation assertions passed, not that validity was kept.
- Malformed or unusual XMP is rewritten with a warning, and foreign properties
  may be lost in that case.

### Office (OOXML / ODF)

- **Supported subtypes:** `docx`, `xlsx`, `pptx`, `docm`, `xlsm`, `pptm` (OOXML)
  and `odt`, `ods`, `odp` (ODF). Only these ZIP-based subtypes are supported.
- **ODF packaging:** the `mimetype` entry must remain the **first** ZIP entry
  and **uncompressed (stored)**; this is asserted by the preservation suite.
- **Signed documents:** editing a digitally signed Office document **invalidates
  its signature**. A warning is shown in review, but the user may still write
  deliberately.
- **Macros:** macro-enabled files (`.docm`, `.xlsm`, `.pptm`) keep their macro
  parts best-effort. Running macros is the reader's responsibility and is never
  executed by MeInsert.
- **Rejected inputs:** encrypted Office files and legacy binary formats (`.doc`,
  `.xls`, `.ppt`).
- **Validation before any read or write:** MeInsert validates package semantics.
  OOXML content types, root relationships, and the main document part resolved
  from its relationship must agree (Transitional and Strict namespaces are
  recognised); ODF validates the manifest, `mimetype`, and `content.xml`. This is
  **structural and XML validation, not full Office schema conformance** — a
  package can still fail to open in a specific Office version for reasons
  MeInsert does not model.
- **Namespace handling:** metadata XML is parsed namespace-aware, so arbitrary
  valid prefixes and default namespaces work without creating unbound prefixes.
- **Write scope:** writes rewrite only the metadata parts
  (`docProps/core.xml`, `docProps/app.xml`, `meta.xml`, `docProps/custom.xml`).
  A SHA-256 ZIP-entry check verifies that every other entry is byte-identical,
  and a failed check is surfaced as a `failed` integrity result.

### Office preview

- The card shown for Office files is a summary of the metadata already read
  (title, creator, available counts, signature/macro status), plus an optional
  bounded text excerpt (up to ~280 characters from the first paragraphs, sheet
  names, or first slide).
- It is deliberately **not** a full-fidelity rendering of the document pages;
  use a document reader if you need to inspect the contents.

### ZIP detection and decompression bounds

- Detection never loads a whole Office file: it reads only the EOCD tail
  (≤65,557 bytes), the central directory (≤8 MiB) plus a small prefix window, and
  the stored `mimetype` local record.
- During inspection only known metadata/preview parts are inflated, each capped
  at 2 MiB. A larger preview part is reported as a finding with empty data rather
  than an error, and media/other entries are never decompressed.
- Rejected: duplicate names (after `./`, `\`, and percent-decode normalization),
  path traversal/absolute paths, overlapping local or central ranges,
  inconsistent EOCD counts, and malformed deflate/CRC.
- ZIP64 archives are not classified during detection and cannot be written.

### PNG / WebP

- Camera fields are written as XMP (`XMP-tiff:Make/Model`, `XMP-aux:Lens`,
  `XMP-exif:DateTimeOriginal`), not binary EXIF; EXIF-only readers may not show
  them.

### Ogg

- Only Vorbis and Opus are supported; FLAC-in-Ogg and Speex are rejected on both
  read and write.
- Not all players display Ogg/Opus cover art.
- The Ogg `vendor` string may be rewritten by Mediabunny
  (`ENGINE_VENDOR_CHANGED`), an explicit warning limited to that
  format/tag/engine signature; loss of the `ENCODER` tag still fails.
- When the Vorbis comment fits in a single leading Ogg page, writes patch only
  that page via `Blob.slice()` instead of buffering the whole file. Multi-page
  comments, chained streams and malformed pages fall back to a full remux with
  an explicit warning; output is still read back and verified before download.

### FLAC / Ogg picture metadata

- Native picture blocks/comments are preserved rather than regenerated, but the
  broader fixture matrix (multiple picture types, Unicode descriptions,
  dimensions/depth/colors, back covers) is what has been verified; it is not
  exhaustive for all encoders.

### MP4 / M4A / MOV cover

- The `covr` atom accepts JPEG/PNG/WebP only; GIF and BMP covers are rejected by
  the picker policy.
- Cover bytes are read via an extra Mediabunny pass because ExifTool WASM cannot
  return raw binary.

### Covers (general)

- JPEG/PNG/WebP up to 10 MB for all formats; GIF/BMP up to 10 MB for
  MP3/FLAC/OGG/MKV only (not MP4 `covr`).
- Some players do not display Ogg/Opus covers.

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
