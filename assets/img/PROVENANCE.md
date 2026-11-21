# MeInsert — Image asset provenance

All image files in this directory are **original brand assets created for
the MeInsert project** by the project author. They are not stock
photography, not copied from a third-party site, and not distributed
under any other license. They are part of MeInsert (AGPLv3 — see
[`LICENSE`](../../LICENSE)).

| File | Dimensions | Purpose | Compression / provenance |
|---|---|---|---|
| `apple-touch-icon.png` | 180×180 | Apple touch icon (PNG required by iOS) | `ff03603` (2026-11-03). Recompressed 2026-11-20 with ImageMagick `convert -strip -colors 256 -define png:compression-level=9`: 13.4 KB → 6.2 KB; RMSE 0.0063. |
| `favicon-64.png` | 64×64 | Browser favicon (PNG kept for broad support) | `ff03603` (2026-11-03). Palette recompression 2026-11-20: 4.6 KB → 2.0 KB; RMSE 0.0073. |
| `logo-96.webp` | 96×96 | Header logo (rendered at 42×42 / 36×36 CSS px) | Replaces `logo-96.png` on 2026-11-20. FFmpeg lossless WebP from the original PNG: `ffmpeg -i logo-96.png -c:v libwebp -lossless 1 -compression_level 6 logo-96.webp`. 2.4 KB → 2.1 KB; RMSE 0. |
| `icon-192.webp` | 192×192 | PWA 192 icon (Chromium accepts WebP; iOS uses the Apple touch PNG) | Replaces `icon-192.png`. FFmpeg `ffmpeg -i icon-192.png -c:v libwebp -quality 90 -compression_level 6 icon-192.webp`. 18.6 KB → 3.6 KB; RMSE 0.0216. |
| `icon-512.webp` | 512×512 | PWA 512 icon + README hero (displayed at 120×120) | Replaces `icon-512.png`. Same FFmpeg WebP q90 command. 61.8 KB → 10.9 KB; RMSE 0.0142. |
| `icon-maskable-512.webp` | 512×512 | PWA maskable icon (safe-zone derivative of the 512 artwork) | Replaces `icon-maskable-512.png`. Same FFmpeg WebP q90 command. 57.5 KB → 8.1 KB; RMSE 0.0130. Geometry and safe zone unchanged. |
| `og-image.jpg` | 1200×630 | Open Graph / Twitter / README preview | Replaces `og-image.png` and the temporary `og-image.webp`. JPEG is the safest compact format for social crawlers. FFmpeg `ffmpeg -i og-image.png -q:v 85 og-image.jpg`. 343.0 KB → 22.5 KB; RMSE 0.0230. |

## Rights statement

- **Author**: the MeInsert project author (git handle `mifada2543`).
- **Tooling**: brand artwork authored for this repository. PNG recompression uses
  ImageMagick; WebP/JPEG derivatives use FFmpeg. Both are development tools only
  and are not runtime dependencies of MeInsert.
- **No embedded third-party artwork**: fonts in the artwork (if any) are the
  project's IBM Plex family (OFL 1.1) — see
  `../THIRD_PARTY_LICENSES.md`. No photographs, illustrations, or icons from
  stock libraries or other projects are reproduced.

## Maintenance

If you replace any file, update this table (author, date, tool, before/after
size, measured RMSE) in the same commit. Do not add asset files without an
entry here. Keep the PNG variants for Apple touch and the browser favicon;
WebP is used for browser/PWA icons and JPEG for social previews.
