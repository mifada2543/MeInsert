<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Troubleshooting / Pemecahan masalah

[English](#english) · [Bahasa Indonesia](#bahasa-indonesia)

MeInsert never overwrites the original file. When a result looks wrong, cancel
and retry with a copy. This page collects common symptoms and safe actions;
per-format limits are in [LIMITATIONS.md](LIMITATIONS.md).

| Need help with | Go to |
|---|---|
| A rejected file, failed write, or offline engine | [Common problems](#common-problems) |
| Sending a useful bug report | [Reporting a problem](#reporting-a-problem) |

---

## English

### Common problems

| Symptom | Cause | Action | Reference |
|---|---|---|---|
| File is rejected or too large | The per-file size cap, or estimated peak memory above the block threshold | Split the file, close heavy tabs, or process fewer files in a batch | [Global limits](LIMITATIONS.md#global-limits) |
| Detected format differs from the extension | Detection reads magic bytes first by design | Verify the source; the output extension follows detected content. Renaming is not conversion | [Format caveats](LIMITATIONS.md#format-specific-caveats) |
| WASM engine will not download | Optional engines load on first use; the CSP allows same-origin requests only | Go online once, use Storage and Offline, then retry. Check that the host serves `.wasm` and `.mjs` | [Deployment](deployment.md#service-worker-caching-on-cloudflare) |
| Integrity result is `failed` | A tag or structure cannot be guaranteed, or the engine refused the write | Read the findings and compare them with the limits. Discard the output if unacceptable; the original is untouched | [Limitations](LIMITATIONS.md) |
| A signature becomes invalid | Editing metadata changes the signed byte range | Keep signed originals unchanged; edit a copy and re-sign it with the proper tool | [Format caveats](LIMITATIONS.md#format-specific-caveats) |
| Cover art is rejected | Size or type policy; MP4 `covr` accepts fewer image types | Compress or convert the image to an allowed type | [Covers](LIMITATIONS.md#covers-general) |
| Office document is rejected | Only ZIP-based OOXML and ODF are supported; encrypted, legacy, and ZIP64 files are not | Convert to a supported subtype and remove encryption | [Office](LIMITATIONS.md#office-ooxml--odf) |
| MKV or WebM write is rejected | Remuxing cannot preserve chapters, attachments, or the timing | Try a constant-timing source, or use MP4 when chapters matter | [MKV / WebM](LIMITATIONS.md#mkv--webm) |
| Lyrics or subtitles are not visible | Browser video cannot render MP4 `wvtt`; styling support varies; cues must be re-imported after reload | Export a `.vtt` sidecar or use a WebVTT-capable player | [Timed text](LIMITATIONS.md#timed-text-lyrics--subtitles) |
| PWA update does not appear | A stale service worker caused by long-lived edge caching of `/sw.js` | Hard-reload or close all tabs. The host should not cache `/sw.js` | [Worker strategy](ARCHITECTURE.md#service-worker--offline-strategy) |
| Preferences are reset | Theme, language, and the policy notice live only in this browser's `localStorage` | Re-apply them. No user file is affected | [Global limits](LIMITATIONS.md#global-limits) |
| The PWA cannot be installed | A secure origin and a supporting browser are required | Use HTTPS or `localhost` in Chrome or Edge | [Installation](../README-en.md#quick-installation-xampp) |
| Batch ZIP falls back to memory | The File System Access API is not available in every browser | Reduce the batch size or use Chrome or Edge | [Batch caveats](LIMITATIONS.md#batch-caveats) |

### Reporting a problem

Open an issue with the matching template and include:

1. The version shown in the README badge and the browser name and version.
2. The format and file size, plus a reproducible sample when sharing is allowed.
3. Exact steps, including whether offline mode was active.
4. A screenshot of the integrity or review dialog and any Console messages.
5. Whether the behavior reproduces in another tab or device.

Do not attach private or sensitive files without redacting them first. Use
[SECURITY.md](../SECURITY.md) for vulnerabilities rather than ordinary bugs.

### Related

[Documentation map](README.md) · [Testing guide](TESTING.md) ·
[Issue templates](../.github/ISSUE_TEMPLATE/)

---

## Bahasa Indonesia

### Masalah umum

| Gejala | Penyebab | Tindakan | Rujukan |
|---|---|---|---|
| File ditolak atau terlalu besar | Batas ukuran per file, atau estimasi memori puncak di atas ambang blokir | Kecilkan file, tutup tab berat, atau proses lebih sedikit file per batch | [Batas global](LIMITATIONS.md#global-limits) |
| Format terdeteksi berbeda dari ekstensi | Deteksi mengutamakan magic bytes secara sengaja | Periksa file asal; ekstensi hasil mengikuti isi. Mengganti nama bukan konversi | [Caveat format](LIMITATIONS.md#format-specific-caveats) |
| Engine WASM gagal diunduh | Engine opsional dimuat saat pertama dipakai; CSP hanya mengizinkan origin yang sama | Hubungkan internet sekali, buka Penyimpanan dan Offline, lalu ulangi. Pastikan host menyajikan `.wasm` dan `.mjs` | [Deployment](deployment.md#cache-service-worker-di-cloudflare) |
| Hasil integritas `failed` | Ada tag/struktur yang tidak bisa dijamin, atau engine menolak menulis | Baca findings dan bandingkan dengan batasan. Buang hasil bila tidak dapat diterima; file asli tetap utuh | [Keterbatasan](LIMITATIONS.md) |
| Tanda tangan jadi tidak valid | Mengubah metadata mengubah rentang byte yang ditandatangani | Biarkan berkas bertanda tangan apa adanya; edit salinan lalu tanda tangani ulang | [Caveat format](LIMITATIONS.md#format-specific-caveats) |
| Sampul ditolak | Aturan ukuran/jenis; `covr` MP4 menerima lebih sedikit jenis gambar | Kompres atau konversi ke jenis yang diizinkan | [Sampul](LIMITATIONS.md#covers-general) |
| Dokumen Office ditolak | Hanya OOXML/ODF berbasis ZIP yang didukung; terenkripsi, lama, dan ZIP64 tidak | Konversi ke subjenis yang didukung dan hapus enkripsi | [Office](LIMITATIONS.md#office-ooxml--odf) |
| Penulisan MKV/WebM ditolak | Remux tidak dapat menjaga chapter, attachment, atau timing | Coba sumber dengan timing konstan, atau pakai MP4 bila chapter penting | [MKV / WebM](LIMITATIONS.md#mkv--webm) |
| Lirik atau subtitle tidak tampil | Video browser tidak merender `wvtt` MP4; dukungan gaya berbeda; cue harus diimpor ulang | Ekspor sidecar `.vtt` atau pakai pemutar yang mendukung WebVTT | [Teks berirama](LIMITATIONS.md#timed-text-lyrics--subtitles) |
| Update PWA tidak muncul | Service worker basi karena `/sw.js` di-cache edge terlalu lama | Muat ulang paksa atau tutup semua tab. Host sebaiknya tidak meng-cache `/sw.js` | [Strategi worker](ARCHITECTURE.md#service-worker--offline-strategy) |
| Preferensi kembali ke awal | Tema, bahasa, dan notifikasi kebijakan hanya ada di `localStorage` browser ini | Atur ulang. Tidak ada file pengguna yang terpengaruh | [Batas global](LIMITATIONS.md#global-limits) |
| PWA tidak bisa dipasang | Diperlukan origin aman dan browser yang mendukung | Pakai HTTPS atau `localhost` di Chrome/Edge | [Instalasi](../README.md#instalasi-cepat-xampp) |
| ZIP batch jatuh ke memori | File System Access API tidak tersedia di semua browser | Kurangi jumlah file atau pakai Chrome/Edge | [Caveat batch](LIMITATIONS.md#batch-caveats) |

### Melaporkan masalah

Buka issue dengan template yang sesuai dan sertakan:

1. Versi pada badge README serta nama dan versi browser.
2. Format dan ukuran file, serta contoh yang bisa direproduksi bila boleh dibagikan.
3. Langkah persis, termasuk apakah mode offline aktif.
4. Tangkapan layar dialog integritas atau tinjauan dan pesan Console.
5. Apakah perilaku muncul juga di tab atau perangkat lain.

Jangan lampirkan file pribadi atau sensitif tanpa menganonimkannya. Untuk
kerentanan gunakan [SECURITY.md](../SECURITY.md), bukan issue bug biasa.

---

### Terkait

[Peta dokumentasi](README.md) · [Panduan pengujian](TESTING.md) ·
[Template issue](../.github/ISSUE_TEMPLATE/)
