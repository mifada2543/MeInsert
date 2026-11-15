# Fixture pengujian / compatibility fixtures

All media is purpose-built for MeInsert: synthetic gradients, solid-color frames,
440 Hz tones, and a one-page test document. No personal metadata or third-party
media. Keep each fixture below 1 MB (these are all below 20 KB). Generator and
harness source use the project's AGPLv3 header.

## Regenerate

From the repository root, after `npm ci`:

```sh
npm run fixtures:generate
```

Requires Node 22, ffmpeg (libmp3lame, flac, libopus, libvorbis, libspeex,
libx264, libvpx, libwebp, AAC), ImageMagick `convert`, and OpenSSL 3.
`generate.mjs` is the complete auditable recipe. It does not download anything.
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

### EXIF construction

`generate.mjs` constructs a little-endian TIFF with IFD0 Artist, Software,
ImageDescription, XPTitle and XPKeywords, plus an ExifIFD pointer to
DateTimeOriginal. JPEG stores this behind `Exif\0\0` in APP1; PNG stores the TIFF
directly in an `eXIf` chunk with CRC32. Title/keywords use genuine EXIF XP tags;
the app's editable title uses XMP-dc:Title, so its title edit adds XMP rather than
pretending XPTitle is that field. The harness also asserts the original real
EXIF artist/software/date/title/keyword inventory was read.

### Signature provenance and limitations

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

### Supplemental timing / picture corpus

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
