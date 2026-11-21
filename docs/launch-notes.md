<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Launch notes (drafts for the owner)

> [!NOTE]
> **These are drafts only.** The owner performs all posting, sets the GitHub
> repository description and topics, and configures the social preview image
> manually. Nothing here is published by the project or by CI.

## Contents

- [GitHub repository description](#github-repository-description)
- [Suggested GitHub topics](#suggested-github-topics)
- [Show HN — draft (English)](#show-hn--draft-english)
- [Show HN — draft (Bahasa Indonesia)](#show-hn--draft-bahasa-indonesia)

## GitHub repository description

English (≤350 characters):

```
Edit image, PDF, audio, video and Office metadata locally in your browser. 100% client-side — no upload, no account, no analytics. Works offline as a PWA. AGPLv3. Live: https://meinsert.my.id/
```

Bahasa Indonesia (padanan, ≤350 karakter):

```
Edit metadata gambar, PDF, audio, video, dan dokumen Office langsung di browser Anda. 100% sisi klien — tanpa upload, akun, atau analitik. Berfungsi offline sebagai PWA. AGPLv3. Live: https://meinsert.my.id/
```

## Suggested GitHub topics

Lowercase, hyphenated. Refined from the supported formats and the README's
feature list; the owner selects the final subset on the repository page.

```
privacy metadata-editor pwa browser-only offline-first webassembly exif id3 pdf exiftool matroska mp4 office ooxml odf image-metadata audio-metadata video-metadata subtitle-editor lyrics-editor no-upload client-side javascript
```

The synchronized lyrics/subtitle editor (extended from MEeL) is credited
explicitly in `NOTICE.md` / `NOTICE-en.md`, with the exact source and adapted
file list in `assets/THIRD_PARTY_LICENSES.md`.

## Show HN — draft (English)

> [!TIP]
> Keep the tone honest, low-key, and factual. Confirm the live URL and version
> before posting.

**Show HN: MeInsert — edit file metadata in your browser, no upload**

Hi HN,

I built MeInsert because I wanted to clean up metadata on photos, PDFs, music,
and video files without sending those files to a website.

It is a 100% client-side metadata editor: everything runs in the browser using
vanilla JavaScript, WASM, and Web Workers. Files are never uploaded, there is no
account, and there is no analytics or external request — you can verify this in
the DevTools Network tab, and it works offline as an installable PWA.

Supported formats: JPEG, PNG, WebP, TIFF, PDF, MP3, FLAC, Ogg Vorbis/Opus,
MP4/M4A/MOV, MKV/WebM, and Office documents (DOCX/XLSX/PPTX/ODT/ODS/ODP).
You can edit common fields, add custom tags, and
replace or remove cover art. Before saving you get a review of exactly what
changes; after writing, the output is read again and compared against the
original so you can see what was preserved. The original file is never
overwritten — you download a new one.

It is not perfect. Some codecs and containers cannot preserve everything: signed
PDFs lose their signature validity, MKV/WebM chapters and attachments are not
carried over, and a few exotic ID3 frames may be dropped. These cases are
documented and surfaced in the integrity report rather than hidden.

The code is AGPLv3 and the source is on GitHub:
https://github.com/mifada2543/meinsert

Live app: https://meinsert.my.id/

Happy to answer questions about the architecture or the format-specific
trade-offs.

## Show HN — draft (Bahasa Indonesia)

> [!TIP]
> Draf, belum dipublikasikan. Konfirmasi URL live dan versi sebelum memposting.

**Show HN: MeInsert — edit metadata file di browser, tanpa upload**

Halo HN,

Saya membuat MeInsert karena ingin membersihkan metadata foto, PDF, musik, dan
video tanpa mengirim file tersebut ke sebuah situs.

MeInsert adalah editor metadata 100% di sisi klien: semuanya berjalan di browser
memakai JavaScript vanilla, WASM, dan Web Worker. File tidak pernah diunggah,
tidak ada akun, dan tidak ada analitik atau permintaan ke luar domain — Anda
bisa mengeceknya di tab Network DevTools, dan aplikasinya tetap bisa dipakai
offline sebagai PWA yang bisa dipasang.

Format yang didukung: JPEG, PNG, WebP, TIFF, PDF, MP3, FLAC, Ogg Vorbis/Opus,
MP4/M4A/MOV, MKV/WebM, serta dokumen Office (DOCX/XLSX/PPTX/ODT/ODS/ODP).
Anda bisa mengubah field umum, menambah custom tag,
dan mengganti atau menghapus sampul. Sebelum menyimpan, tersedia dialog tinjauan
yang menunjukkan persis apa yang berubah; setelah penulisan, hasil dibaca lagi
dan dibandingkan dengan berkas asli agar terlihat apa yang tetap utuh. File asli
tidak pernah ditimpa — Anda mengunduh file baru.

Aplikasi ini tidak sempurna. Beberapa codec dan container tidak bisa menjaga
semuanya: PDF bertanda tangan kehilangan validitas tanda tangannya, chapter dan
attachment MKV/WebM tidak ikut terbawa, dan beberapa frame ID3 yang tidak umum
mungkin hilang. Kasus-kasus ini didokumentasikan dan ditampilkan di laporan
integritas, bukan disembunyikan.

Kodenya berlisensi AGPLv3 dan sumbernya ada di GitHub:
https://github.com/mifada2543/meinsert

Aplikasi live: https://meinsert.my.id/

Saya dengan senang hati menjawab pertanyaan soal arsitektur atau kompromi tiap
format.
