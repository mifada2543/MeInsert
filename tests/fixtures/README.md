# Test fixtures / Fixture pengujian

Synthetic, purpose-built files used by the unit, E2E, and compatibility suites.

## Contents

- [Regenerate](#regenerate)
- [Files](#files)
- [Office fixtures (OOXML + ODF)](#office-fixtures-ooxml--odf)
- [EXIF construction](#exif-construction)
- [Signature provenance and limitations](#signature-provenance-and-limitations)
- [Supplemental timing / picture corpus](#supplemental-timing--picture-corpus)

## Overview

All media is purpose-built for MeInsert: synthetic gradients, solid-color frames,
440 Hz tones, and a one-page test document. No personal metadata or third-party
media. Keep each fixture below 1 MB (the long playback fixture is about 160 KB). Generator and
harness source use the project's AGPLv3 header.

## Regenerate

From the repository root, after `npm ci`:

```sh
npm run fixtures:generate
```

Requires Node 22, ffmpeg (libmp3lame, flac, libopus, libvorbis, libspeex,
libx264, libvpx, libwebp, AAC), ImageMagick `convert`, OpenSSL 3, and the
vendored ExifTool WASM engine (used to write `gps-iptc.jpg` from Node).
`generate.mjs` is the auditable compatibility-fixture recipe. It does not download anything.
The two long playback fixtures are generated, when missing, by
`tests/e2e/single-undo-redo.mjs` using FFmpeg; run `npm run test:undo`.
Regeneration reproduces the content/metadata and verification properties, not
identical bytes: codec versions, Ogg serial numbers, PDF IDs, signing time, and
the freshly generated RSA key/certificate can differ. CI consumes the stored
fixtures; it also uses FFmpeg/ffprobe for independent output checks and the
supplemental timing corpus. ImageMagick is required only for full regeneration.

## Files

Sizes below describe the generated fixture set; metadata writers produce larger
outputs in memory, not changes to these source fixtures.

| File | Bytes | Generation / purpose | Expected behavior |
| --- | ---: | --- | --- |
| `pattern.jpg` | 765 | ImageMagick gradient JPEG; handmade EXIF APP1/TIFF | Read EXIF, edit title, preserve untouched tags |
| `clean-gps.jpg` | 707 | Standalone Node JPEG with a real EXIF GPS IFD + Artist/Software/Owner/Orientation | Fase 3 clean-metadata E2E: detect and remove GPS/identity/software, keep orientation |
| `gps-iptc.jpg` | 5591 | `pattern.jpg` plus GPS/IPTC/XMP written by the vendored ExifTool WASM engine | Read/edit GPS, IPTC, and XMP fields; edit → write → re-read → integrity round-trip for the extended image fields |
| `pattern.png` | 2061 | Node zlib/CRC PNG with handmade `eXIf` TIFF chunk | Read EXIF, edit XMP title, preserve original EXIF |
| `pattern.webp` | 144 | ffmpeg libwebp from gradient PNG | Add/read back title |
| `pattern.tif` | 394 | ImageMagick TIFF from gradient | Add/read back title; strict integrity must pass |
| `mislabeled.jpg` | 2061 | Exact PNG bytes under a JPEG extension | Warn; detect PNG; default output/download `.png` (not reject) |
| `tone.mp3` | 2664 | ffmpeg libmp3lame, ID3v2.3 title/artist/album/comment | Title round-trip; preserve other tags |
| `tone.flac` | 11757 | ffmpeg FLAC with Vorbis comments | Title round-trip; preserve other tags |
| `tone.opus` | 5722 | ffmpeg libopus, Ogg comments + FLAC-picture block | Title round-trip; retain byte-identical PNG cover |
| `tone.ogg` | 7089 | ffmpeg libvorbis, comments + FLAC-picture block | Same, for Vorbis |
| `clip.mp4` | 1815 | ffmpeg H.264, 3 solid-color frames + tags | Title round-trip without changing media/untouched tags |
| `clip.mkv` | 1500 | Same frames in Matroska | Same; duration must not change |
| `clip.webm` | 718 | ffmpeg VP8, 3 solid-color frames + tags | Same, for WebM |
| `clip.mov` | 1747 | ffmpeg H.264 in QuickTime | Same, for MOV |
| `tone.m4a` | 3531 | ffmpeg AAC in iPod/M4A container | Same, for M4A |
| `document.pdf` | 1409 | pdf-lib one-page document with standard Info metadata | Title round-trip; preserve subject/author/dates/keywords/page count |
| `signed.pdf` | 18164 | Same PDF, signature field + genuine detached CMS (RSA-2048/SHA-256) | Warn before editing; retain signature Contents bytes; **rewriting invalidates the signature** |
| `signed-certificate.pem` | 1164 | OpenSSL self-signed synthetic certificate, also embedded in CMS | Public test certificate only; no CA/trust assertion |
| `reject-flac.ogg` | 3673 | ffmpeg FLAC encoded into Ogg | Both read and write must reject with codec/container error |
| `reject-speex.ogg` | 1255 | ffmpeg libspeex, 16 kHz, Ogg | Both read and write must reject with codec/container error |
| `cover.gif` | 1692 | ImageMagick GIF from synthetic gradient | MP4 picker rejects; MP3/FLAC/Opus/Vorbis/MKV embed/reread exact bytes |
| `cover.bmp` | 3210 | ImageMagick BMP from synthetic gradient | Same as GIF |
| `tone-long.mp3` | 161053 | ffmpeg libmp3lame, 20 s 440 Hz tone + embedded MJPEG cover | Browser fixture: long enough to prove the preview keeps playing while the card is rebuilt |
| `clip-long-cover.mp4` | 16503 | ffmpeg H.264, 20 s solid-color frames + attached MJPEG cover | Same, for the video preview |
| `sample.docx` | 1883 | Node + vendored fflate OOXML ZIP with core/app metadata | Read/edit Word metadata; preserve package parts |
| `sample.xlsx` | 2465 | Same, Excel package (+ worksheet) | Read/edit Excel metadata |
| `sample.pptx` | 2551 | Same, PowerPoint package (+ slide) | Read/edit PowerPoint metadata |
| `sample.docm` | 2277 | Word macro-enabled OOXML + dummy `word/vbaProject.bin` | Detect macro-bearing OOXML; warn before editing |
| `sample.xlsm` | 2868 | Excel macro-enabled OOXML + dummy `xl/vbaProject.bin` | Same, for Excel |
| `sample.pptm` | 2958 | PowerPoint macro-enabled OOXML + dummy `ppt/vbaProject.bin` | Same, for PowerPoint |
| `sample.odt` | 1219 | Node + vendored fflate ODF text with full meta.xml | Read/edit OpenDocument Text metadata |
| `sample.ods` | 1282 | Same, ODF spreadsheet | Read/edit OpenDocument Spreadsheet metadata |
| `sample.odp` | 1303 | Same, ODF presentation | Read/edit OpenDocument Presentation metadata |
| `signed.docx` | 2161 | `sample.docx` plus a mock `_xmlsignatures/origin.sigs` part | Warn on signed-package detection; marker only, NOT a real signature |
| `encrypted.docx` | 512 | Mock OLE2-like header (`D0 CF 11 E0 A1 B1 1A E1`) + synthetic bytes | Exercise the unsupported/encrypted error path; NOT a real encrypted document |

## Office fixtures (OOXML + ODF)

Run `node tests/fixtures/office-generate.mjs` from the repository root to
regenerate all eleven Office fixtures. This generator uses only Node built-ins
and the already-vendored `assets/vendor/fflate.mjs` (`zipSync`, `strToU8`) — no
ffmpeg, ImageMagick, network, or third-party data. Every file is deterministic
(fixed ZIP entry date, no timestamps), so rerunning reproduces byte-identical
output, and all content is synthetic and clearly test-only. The core/app
metadata uses Indonesian test values (`Contoh Judul`, `Penguji Sintetis`,
`uji, meinsert`, `Perusahaan Uji`, `MeInsert Test`). For ODF, `mimetype` is the
first ZIP entry, STORED (uncompressed, method 0), with no extra field so its
content starts at byte 38; the generator verifies this. `signed.docx` is a
marker-only mock (folder presence triggers the adapter warning) and
`encrypted.docx` is a mock header, not a genuine signed or encrypted document.

## EXIF construction

`generate.mjs` constructs a little-endian TIFF with IFD0 Artist, Software,
ImageDescription, XPTitle and XPKeywords, plus an ExifIFD pointer to
DateTimeOriginal. JPEG stores this behind `Exif\0\0` in APP1; PNG stores the TIFF
directly in an `eXIf` chunk with CRC32. Title/keywords use genuine EXIF XP tags;
the app's editable title uses XMP-dc:Title, so its title edit adds XMP rather than
pretending XPTitle is that field. The harness also asserts the original real
EXIF artist/software/date/title/keyword inventory was read.

`clean-gps.jpg` is built by `tests/fixtures/clean-gps.generate.mjs`, a standalone
generator that needs only Node (no ffmpeg, ImageMagick, or network access). It
emits a deterministic 707-byte 8×8 baseline JPEG whose APP1 holds a real
little-endian TIFF: IFD0 contains Artist, Software, OwnerName and a handmade
Orientation=6 tag; a proper ExifIFD holds ImageUniqueID and BodySerialNumber;
and a genuine GPS IFD carries GPSVersionID, GPSLatitudeRef/GPSLatitude,
GPSLongitudeRef/GPSLongitude, GPSAltitudeRef and GPSAltitude. Run
`node tests/fixtures/clean-gps.generate.mjs` from the repository
root to regenerate it byte-for-byte. The Fase 3 clean-metadata E2E tests use it
to verify that location/identity/software tags are removed while orientation is
kept, and that no data is fetched from the network.

`gps-iptc.jpg` is produced by `generate.mjs` from `pattern.jpg` through the vendored
ExifTool WASM engine (`writeTags`). It carries a real GPS IFD with latitude/longitude
references, altitude and date stamp, a set of IPTC tags (Credit, Source, By-line,
Caption-Abstract, Keywords, CopyrightNotice), and XMP properties for the extended
image fields (credit, source, caption writer, job title, copyright owner, rating,
label, identifier, location). ExifTool writes the XMP IPTC Core / Extension aliases the
installed engine accepts (`XMP-photoshop:Source`, `XMP-photoshop:AuthorsPosition`,
`XMP-plus:CopyrightOwnerName`, `XMP-xmp:Rating`, `XMP-xmp:Label`), which are the raw tags
the image adapter reads back. The extended-field unit tests use this fixture for a full
read → plan → write → re-read → verifyIntegrity round-trip.

## Signature provenance and limitations

The generator reserves a PDF signature `Contents`, patches a fixed-width
`ByteRange`, signs the exact covered bytes with `openssl cms -sign -binary`, and
independently verifies the result with `openssl cms -verify -binary -noverify`.
The harness repeats that verification before launching Chrome. `-noverify`
disables certificate-chain trust validation, **not** the CMS content/signature
verification. This is a genuine cryptographic test signature, not an empty or
signature-shaped dictionary. Temporary private keys are deleted; none are
stored in the fixture set. This does not claim PAdES certification, viewer trust,
or a production signing identity.

An additional independent local check, `pdfsig tests/fixtures/signed.pdf`, reports
“Total document signed”, “Signature is Valid”, and the expected untrusted
self-signed certificate. `pdfsig` is optional and is not a CI dependency.

Current pdf-lib rewriting retains the signature's Contents bytes but changes
the signed ByteRange data and invalidates its cryptographic signature. The
harness reports that distinction explicitly and checks the read warning and
pre-save `SIGNED_PDF` risk. It does **not** claim signature validity survives.

Some external players do not display Ogg/Opus covers even when embedded and
readable. The compatibility harness checks actual embedded image bytes, not
player UI behavior.

## Supplemental timing / picture corpus

`mkv-generate.mjs` generates an isolated temporary corpus without touching the
stored fixtures: 0.3s/1.1s reordered B-frame video, no-B-frame video, nonzero
on-grid and off-grid starts, AAC audio-only/audio+video, and variable timing.
The off-grid/AAC/variable examples currently require a safe WRITE_FAILED
rejection when packet timing cannot be preserved by the pinned muxer; these
are not claimed successful writes. Run `node tests/compat/mkv-duration.mjs`
or the default compatibility suite (the `mkv-timing` job).

`tests/compat/vorbis-preservation.mjs` synthesizes multiple numeric picture types
and back covers with Unicode descriptions and deliberately nonzero dimensions,
depth and color counts. It checks complete picture structures through keep,
set, and remove and compares audio packet SHA-256 using ffprobe. No external
artwork is fetched; generated variants are removed after the test.

See [`../compat/README.md`](../compat/README.md) for execution, scope, repairs,
remaining warnings, and format limitations. The stored fixture matrix passes;
this is not a guarantee for every possible file.
