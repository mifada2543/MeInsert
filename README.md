<div align="center">

<img src="assets/img/icon-512.png" alt="MeInsert" width="120" height="120" />

# MeInsert

**🇮🇩 Indonesia** · [🇬🇧 English](README-en.md)

**Edit metadata tanpa upload — 100% di browser**

Baca & tulis metadata gambar, PDF, audio, dan video langsung di perangkat Anda.
Tidak ada server. Tidak ada upload. Tidak ada akun.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_Now-2ea44f?style=for-the-badge)](https://meinsert.my.id/)
[![PWA](https://img.shields.io/badge/PWA-Installable-7B3FF2?style=for-the-badge)](https://meinsert.my.id/)
[![Offline](https://img.shields.io/badge/Offline-Ready-10b981?style=for-the-badge)](https://meinsert.my.id/)
[![CI](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml/badge.svg)](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml)

[![Version](https://img.shields.io/badge/version-v1.2.0-blue?style=for-the-badge)](./package.json)
[![License](https://img.shields.io/badge/Lisensi-AGPLv3-orange?style=for-the-badge)](./LICENSE)
[![Client-side](https://img.shields.io/badge/100%25_Client--side-lightgrey?style=for-the-badge)]()
[![No Build](https://img.shields.io/badge/Static-No%20Build-purple?style=for-the-badge)]()

![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-624DE3?style=flat-square)
![Service Worker](https://img.shields.io/badge/Service_Worker-PWA-61DAFB?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square)

<br/>

[🚀 Coba Demo Langsung](https://meinsert.my.id/) ·
[📄 Edit Satu File](./single.html) ·
[📦 Proses Massal / Batch](./batch.html) ·
[⚙️ Instalasi](#instalasi-cepat-xampp)

![Preview](assets/img/og-image.png)

</div>

> **MeInsert** adalah editor metadata lokal berbasis web. Semua pemrosesan berjalan di sisi klien dengan WebAssembly + Web Workers — file Anda tidak pernah meninggalkan perangkat, bahkan bisa dipakai offline setelah kunjungan pertama.

---

## Daftar Isi

- [Kenapa MeInsert?](#kenapa-meinsert)
- [Format Didukung](#format-didukung)
- [Cara Pakai (30 Detik)](#cara-pakai-30-detik)
- [Fitur Unggulan](#fitur-unggulan)
- [Bahasa Antarmuka](#bahasa-antarmuka)
- [Instalasi Cepat (XAMPP)](#instalasi-cepat-xampp)
- [Teknologi](#teknologi)
- [Keterbatasan](#keterbatasan)
- [Development](#development)
- [Lisensi](#lisensi)
- [Kebijakan Penggunaan dan Privasi](#kebijakan-penggunaan-dan-privasi)

---

## Kenapa MeInsert?

| 🔒 Privasi Absolut | ⚡ Cepat & Ringan | 📴 Offline-First |
|---|---|---|
| Semua dibaca/ditulis di browser via WASM + Workers. Tidak ada upload ke server mana pun. | Statis — tanpa backend dan tanpa build saat deploy. Jalan langsung dari XAMPP/Apache. | App shell tersedia offline setelah pemasangan cache selesai. Engine format dan WASM tersedia offline setelah sekali dimuat. |

**Dua mode, satu prinsip:**
- **Satu file** — editor satuan dengan field dinamis mengikuti format file
- **Banyak file (Batch)** — periksa, edit per grup format atau pakai field standar lintas format, unduh ZIP + laporan JSON/CSV

---

## Format Didukung

Deteksi otomatis dari **magic bytes** (bukan hanya ekstensi), lalu hanya field yang relevan untuk format tersebut yang ditampilkan.

| Kategori | Format | Metode Penulisan |
|---|---|---|
| 🖼️ **Gambar** | JPEG, PNG, WebP, TIFF | XMP + EXIF, IPTC untuk JPEG/TIFF |
| 📄 **PDF** | PDF | Info Dictionary + XMP stream |
| 🎵 **Audio** | MP3, FLAC, OGG Vorbis / Opus | ID3v2.3, Vorbis Comment (remux lossless) |
| 🎬 **Video** | MP4 / M4A / MOV, MKV / WebM | ItemList + XMP (ExifTool), Matroska SimpleTag (remux lossless) |

### Sampul / Thumbnail
Embed cover image (JPEG/PNG/WebP ≤ 10 MB; GIF/BMP juga untuk MP3, FLAC, OGG/Opus, dan MKV) secara native per format — `APIC` untuk MP3, `METADATA_BLOCK_PICTURE` untuk FLAC/OGG/Opus, `covr` untuk MP4/M4A (JPEG/PNG/WebP saja), Matroska attachment untuk MKV/WebM. Bisa diganti/dihapus.

---

## Cara Pakai (30 Detik)

### 1. Pilih File
Buka beranda → pilih **Satu file** untuk edit satuan atau **Banyak file** untuk batch.

### 2. Edit Metadata
Field muncul dinamis sesuai format. Ubah yang Anda butuhkan, tambah **tag kustom**, ganti sampul, atau kosongkan field untuk menghapus tag.

### 3. Simpan & Unduh
Klik **Simpan** → tinjau seluruh perubahan → konfirmasi → hasil dibaca ulang & diverifikasi otomatis → unduh file baru (atau ZIP untuk batch). File asli tidak pernah ditimpa.

> **Pelacakan perubahan:** hanya perubahan field yang diminta yang dikirim untuk ditulis. Ini bukan jaminan seluruh tag yang tidak didukung tetap utuh; periksa temuan integritas dan keterbatasan di bawah. Ekstensi hasil secara default mengikuti isi terdeteksi; dialog mismatch juga menawarkan pilihan mempertahankan ekstensi asli. Mengganti nama bukan konversi format.

---

## Fitur Unggulan

### Satu File vs Batch — Kapan Pakai Yang Mana?

| | Satu File | Batch (Massal) |
|---|---|---|
| Batas | Maks. 4 GB per file | Video maks. 10 file, Audio maks. 20, Gambar/PDF maks. 50 |
| Edit | Field dinamis, custom tags, raw table + search | Per grup format atau field standar lintas format, pilih file yang diproses, raw tag per file |
| Hasil | Satu file terverifikasi + rename aman | ZIP + laporan JSON/CSV |

### Lainnya
- **Peringatan ekstensi** — jika ekstensi tidak cocok dengan magic bytes, file tetap diproses mengikuti isi dan UI menampilkan peringatan (single maupun batch)
- **Review sebelum tulis** — dialog menampilkan seluruh field, tag kustom, raw tag, dan sampul yang berubah; perubahan yang tidak mengubah nilai otomatis dilewati
- **Verifikasi otomatis** — output dibaca ulang, lalu metadata di luar rencana dibandingkan sebelum vs sesudah (field, tag kustom, raw tag, properti XMP PDF, sampul, dan struktur file)
- **Tag kustom** — tambah metadata non-standar per format (nama native per engine)
- **Global search raw tag** — lihat semua tag mentah + cari cepat
- **Perbesar pratinjau** — klik gambar (pratinjau utama, cover audio, pratinjau cover, pratinjau batch) untuk lightbox layar penuh; klik lagi / scroll untuk zoom, geser untuk menggeser, Esc untuk tutup
- **Tema gelap/terang** — ikut sistem, bisa manual, transisi circular reveal, tanpa flicker (tema diterapkan sebelum paint pertama)
- **Bahasa Indonesia / Inggris** — pilih **ID / EN** di samping tombol tema; preferensi disimpan di perangkat, tanpa menerjemahkan metadata Anda
- **Fokus edit di HP** — navigasi Satu file/Batch disembunyikan selama sesi edit atau pemrosesan dan muncul lagi setelah hasil selesai atau kembali ke pemilihan file; desktop tidak berubah
- **PWA Installable** — pasang ke layar utama dari menu browser; precache app shell, library vendor + ExifTool WASM di-cache saat pertama dipakai
- **Manajemen memori WASM** — worker & ExifTool WASM dilepas otomatis setelah batch, saat idle (~8 menit), dan saat halaman ditutup

---

## Bahasa Antarmuka

Pilih **ID** (Indonesia) atau **EN** (English) di samping tombol tema pada
beranda, editor satu file, maupun batch.

- Pilihan disimpan secara lokal menggunakan kunci `meinsert-language`.
- Saat belum ada pilihan tersimpan, bahasa browser Indonesia/Inggris digunakan;
  bahasa lain memakai Indonesia sebagai fallback.
- Pergantian bahasa tidak memuat ulang halaman dan tidak mengubah file, nilai
  metadata, nama tag teknis, atau skema laporan JSON/CSV.
- Pilihan bahasa berlaku lintas halaman dan tersedia offline bersama app shell.
- Dokumentasi: **[Indonesia](README.md)** · **[English](README-en.md)**.

---

## Instalasi Cepat (XAMPP)

Tidak perlu build. File HTML/CSS/JS statis, vendor sudah termasuk di repo.

```bash
# 1. Clone ke htdocs
cd /opt/lampp/htdocs
git clone https://github.com/mifada2543/meinsert.git MeInsert
cd MeInsert

# 2. (Sekali saja / saat update library) Pasang vendor
npm install
npm run vendor

# 3. Buka di browser
# http://localhost/MeInsert/
# → gunakan menu Install / Tambahkan ke layar utama untuk PWA
```

> Kunjungan pertama tetap online sampai service worker selesai menyimpan app shell. Setelah itu, semua halaman (`/`, `/single.html`, `/batch.html`) bisa dibuka offline. Library vendor (mediabunny, pdf-lib, fflate), adapter format, dan ExifTool WASM (~27 MB) diambil saat pertama dipakai lalu disimpan, jadi pemrosesan format terkait tersedia offline setelah dependensinya selesai dimuat.

**Catatan:** `assets/vendor/` sudah dibundel di repo — `npm run vendor` hanya diperlukan saat update versi library.

Serve lokal tanpa XAMPP:
```bash
npm run serve  # http://localhost:8000
```

---

## Teknologi

| Lapisan | Teknologi |
|---|---|
| **App** | Vanilla JS (ES2022), HTML5, CSS3 (responsive + dark mode) |
| **PWA** | Manifest + Service Worker (precache app shell; vendor & WASM on-demand) |
| **Engine Gambar/MP4** | ExifTool WASM (~27 MB, lazy-load via Worker) |
| **Engine Media** | Mediabunny — remux lossless MP3/FLAC/OGG/MKV |
| **Engine PDF** | pdf-lib — Info Dict + XMP stream |
| **ID3** | browser-id3-writer |
| **ZIP Batch** | fflate (streaming di memori browser) |
| **Worker** | Satu worker per engine + RPC, dispose/idle timeout |

<details>
<summary><strong>Arsitektur & struktur proyek (klik untuk detail)</strong></summary>

### Alur kerja

1. **PWA** → `sw.js` precache app shell; library vendor + ExifTool WASM di-cache on-demand → pemrosesan offline setelah dependensi format dimuat
2. **Deteksi** → `detector.js` baca 128 byte pertama → format & subtype
3. **Adapter** → `registry.js` pilih adapter per format
4. **Worker** → `worker-client.js` spawn worker per engine, dengan dispose/idle timeout
5. **Read** → adapter `read(file)` → normalisasi field standar + raw tags
6. **UI** → `form-view.js` render field dinamis, custom tags, raw tab
7. **Write** → `collectChanges()` → `adapter.write(file, payload)`
8. **Verify** → baca ulang output → bandingkan perubahan
9. **Download** → Blob → `<a download>` / ZIP untuk batch

**Routing statis:** `/` (pemilih mode), `/single.html`, `/batch.html` — semua ter-precache, bekerja offline.

### Struktur proyek

```
MeInsert/
├── index.html                 # Beranda: pilih Satu file / Banyak file
├── single.html                # Editor satu file
├── batch.html                 # Batch: periksa & proses banyak file
├── manifest.json              # PWA manifest
├── sw.js                      # Service worker (precache app shell, vendor & WASM on-demand)
├── .htaccess                  # MIME types & cache headers
├── package.json               # Dev deps & vendor script
├── README.md                  # Dokumentasi Indonesia
├── README-en.md               # Dokumentasi Inggris
├── scripts/vendor.mjs         # Copy node_modules → assets/vendor/
├── scripts/build-css.mjs      # Bundel CSS modular → app.bundle.css
├── eslint.config.js           # Konfigurasi lint (flat config)
├── tests/
│   ├── e2e/smoke.mjs          # Smoke test browser/PWA/batch
│   ├── compat/                # Harness browser dengan worker/adapter asli
│   ├── fixtures/              # Media sintetis kecil + generator dan provenance
│   └── unit/                  # Unit test batch, XMP PDF, format lintas grup, cover, snapshot/change-plan/integrity, manifest
└── assets/
    ├── css/app.css            # Entry point styling (@import modul; responsif, dark mode)
    ├── css/app.bundle.css     # Bundel hasil `npm run build:css` (di-commit, 1 request)
    ├── js/
    │   ├── home.js            # Entry beranda (tema, bahasa, registrasi SW)
    │   ├── app.js             # App shell editor satu file & batch; registrasi SW
    │   ├── editor/            # State, shell, perubahan, tampilan, intake, simpan
    │   ├── i18n/              # Runtime bahasa + kamus Indonesia/Inggris
    │   ├── core/              # detector, registry, tag-utils, format-map, image-utils, errors, pwa, worker-client, metadata-snapshot, change-plan, integrity
    │   ├── batch/             # batch-limits, batch-processor, batch-view, batch-report, batch-zip
    │   ├── engines/exiftool.js
    │   ├── formats/           # image, pdf, mp3, flac, ogg, vorbis-common, mkv, mp4
    │   ├── ui/                # dom, icons, toast, theme, file-card, form-view, raw-view, result-view, review-dialog
    │   └── workers/           # rpc, exiftool.worker, media.worker, pdf.worker
    └── vendor/                # Bundled libraries (tanpa build)
```

### Catatan teknis

- **ExifTool WASM** di-lazy-load via worker dan tidak di-precache; waktu unduh awal bergantung koneksi/perangkat, lalu tersimpan di cache service worker
- **Loading**: beranda memakai `home.js` (kecil); adapter format dan UI batch di-`import()` hanya saat dibutuhkan
- **CSS**: 27 modul digabung jadi 1 bundel (`app.bundle.css`, di-commit) — 26 request @import turun jadi 1
- **Logo header**: `logo-96.png` (2,4 KB, 96×96) untuk tampilan 42 px; ikon PWA 192/512 tetap terpisah
- **PDF:** hanya properti XMP yang diubah yang ditulis ulang; Deskripsi dan properti asing (xmpMM, photoshop, namespace kustom) dipertahankan. Properti XMP diinventarisasi sebelum dan sesudah write; jika paket XMP tidak bisa diparse dengan aman, XMP ditulis ulang dan pengguna diberi peringatan
- **MP3:** tag ID3 lama dihapus saat rewrite; hanya tag TXXX yang diketahui yang dipertahankan
- **FLAC/OGG/MKV:** Mediabunny memakai mode salin stream (`copy: {mode:'forced'}`), tanpa sengaja melakukan encoding ulang. Ini bukan jaminan seluruh metadata, timestamp, atau durasi identik; lihat temuan compatibility harness
- **OGG/Opus:** membutuhkan `copy.shiftTolerance: Infinity` karena paket Ogg pertama ber-timestamp negatif (pre-roll)
- **MP4 cover:** dibaca via pass tambahan Mediabunny (ExifTool WASM tidak bisa kembalikan byte binary murni)
- **Custom tags:** native ExifTool names untuk Gambar/MP4, Info dict keys untuk PDF, TXXX untuk MP3, Vorbis/Matroska keys (uppercase) untuk FLAC/OGG/MKV
- **WASM memory:** satu worker per engine, `dispose`/terminate setelah batch, `pagehide`, idle timeout ~8 menit

</details>

---

## Keterbatasan

- **MP3:** frame ID3 non-standar (selain yang dipetakan) hilang saat menulis
- **MKV:** chapter & attachment tidak dipertahankan saat remux
- **MKV/WebM:** penulisan ditolak bila jumlah track atau timing paket tidak bisa dipertahankan; ini mencakup sebagian input audio, video variable-duration, dan timestamp yang tidak cocok dengan kemampuan muxer saat ini
- **PDF:** PDF terenkripsi tidak didukung; PDF bertanda tangan digital → tanda tangan invalid; XMP yang rusak/aneh akan ditulis ulang (dengan peringatan), sehingga properti asing bisa hilang pada kasus itu
- **PNG/WebP:** field kamera ditulis sebagai XMP (`XMP-tiff:Make/Model`, `XMP-aux:Lens`, `XMP-exif:DateTimeOriginal`), bukan EXIF biner; aplikasi yang hanya membaca EXIF mungkin tidak menampilkannya
- **Batch:** ZIP di browser memakai File System Access API bila didukung (Chrome/Edge — streaming langsung ke disk); fallback ke memori di browser lain — video maks. 10 file (≤1 jam per file, total ≤2 GB), audio maks. 20 (≤30 menit per file, ≤1 GB), gambar/PDF maks. 50 (≤1 GB); file dengan durasi tak terbaca dikunci
- **Batch:** file yang status integritasnya `failed` tidak otomatis masuk ZIP; sertakan lewat opsi di detail file bila tetap ingin mengunduhnya
- **Batch:** field standar (judul, artis, album, tanggal, genre, komentar, hak cipta, komposer, perangkat lunak) bisa diterapkan lintas grup; field yang tidak tersedia di suatu format otomatis dilewati. Custom tags tetap per grup
- **OGG:** hanya Vorbis & Opus (FLAC-in-Ogg/Speex ditolak); tidak semua pemutar tampilkan cover Ogg/Opus
- **Cover:** JPEG/PNG/WebP ≤10 MB untuk semua format; GIF/BMP ≤10 MB hanya untuk MP3/FLAC/OGG/MKV (MP4 `covr` menolak GIF/BMP). Tidak semua pemutar menampilkan cover Ogg/Opus

---

## Development

```bash
# Serve lokal
npm run serve            # http://localhost:8000

# Unit test (batch, XMP PDF, pemetaan lintas format, cover, PNG round-trip)
npm test

# Smoke test browser (butuh Chrome/Chromium, override CHROME_BIN bila perlu)
npm run test:e2e

# Uji UI bilingual ID/EN, pergantian bahasa tanpa reload, dan offline
npm run test:i18n

# Compatibility harness dengan fixture nyata dan worker/adapter produksi
CHROME_BIN=/usr/bin/google-chrome npm run test:compat

# Satu proses terisolasi per grup format; maks. 2 berjalan bersamaan secara default
npm run test:compat -- --concurrency 2
npm run test:compat -- --format mkv,mov

# Regenerasi fixture sintetis (prasyarat: lihat tests/fixtures/README.md)
npm run fixtures:generate

# Update vendor libraries
npm install && npm run vendor

# Lint
npm run lint
```

### CSS: sumber modular → satu bundel

`assets/css/app.css` adalah **entry point** yang meng-`@import` modul per
folder (`base/`, `components/`, `layout/`, `pages/`). Urutan `@import` = urutan
cascade, jadi jangan diurutkan ulang tanpa menguji.

Browser mengunduh tiap `@import` sebagai request terpisah (26 request). Supaya
halaman hanya menarik **1 request CSS**, modul digabung otomatis:

```bash
npm run build:css        # tulis assets/css/app.bundle.css (di-commit)
npm run check:css       # verifikasi bundel sinkron dengan sumber
```

`assets/css/app.bundle.css` **di-commit** ke repository, jadi deploy ke
GitHub Pages tetap tanpa langkah build. Kalau CSS sumber berubah, jalankan
`npm run build:css` — `npm test` (test manifest) dan CI akan gagal kalau
bundelnya basi.

### Service worker

- `sw.js` meng-`precache` *app shell*: halaman, bundel CSS,
  modul inti, worker, font latin, ikon kecil.
- Library besar (mediabunny, pdf-lib, fflate, id3-writer), adapter format,
  font latin-ext, dan ExifTool WASM (27 MB) **diambil saat dipakai** lalu
  otomatis tersimpan — kunjungan pertama jauh lebih ringan.
- Navigasi memakai *stale-while-revalidate*: kunjungan berikutnya dilayani
  seketika dari cache, versi baru diambil di latar belakang.
- **Pembaruan otomatis.** `sw.js` memakai `skipWaiting()` + `clients.claim()`,
  jadi versi baru langsung mengambil alih tanpa perlu menutup semua tab.
  Halaman yang sedang menyunting tidak di-reload paksa: `reload-guard` menunda
  refresh sampai pekerjaan selesai, lalu meminta persetujuan lewat toast
  *"Versi baru MeInsert sudah tersedia"*.
- **Deteksi worker basi.** Halaman melakukan probe versi ke worker aktif. Bila
  worker yang mengendalikan halaman lebih lama dari build halaman — misalnya
  CDN masih menyajikan `sw.js` lama — halaman memaksa pembaruan worker lalu
  menyegarkan diri sendiri. Ini mencegah halaman lama "macet" di versi yang
  tidak kompatibel.
- **Cache shell di-refresh tanpa cache HTTP.** Precache memakai
  `cache: 'reload'`, dan pencarian aset hanya memakai `caches.open(CACHE_VERSION)`
  — bukan `caches.match()` lintas-cache — agar entri dari cache versi lama tidak
  membekukan kode usang.
- Catatan deployment: `sw.js` dikirim dengan `Cache-Control: no-cache,
  must-revalidate` oleh `.htaccess` (XAMPP/Apache). Pada GitHub Pages, atur
  **Cloudflare Cache Rule** agar `/sw.js` tidak di-cache di edge, atau purge
  cache setiap deploy. Tanpa itu, browser bisa menahan worker lama beberapa jam.

### Halaman kebijakan

Footer membuka **[Kebijakan Privasi](privacy.html)** dan
**[Kebijakan Penggunaan](Terms.html)** sebagai halaman HTML ID/EN dengan tema,
header, daftar bagian, dan navigasi yang sama. Keduanya bisa dibaca offline
setelah app shell selesai disimpan. Huruf besar pada `Terms.html` disengaja;
gunakan tautan persis tersebut pada hosting yang membedakan kapitalisasi.

Sumber isi tetap `PRIVACY.md` / `PRIVACY-en.md` dan `TERMS.md` / `TERMS-en.md`.
Halaman HTML dibuat saat pengembangan, bukan melalui unduhan Markdown saat runtime:

```bash
npm run build:policies
npm run check:policies
```

Regenerasi setelah perubahan kebijakan atau header/footer di `index.html`.
HTML hasil generator dilacak di repository; test dan CI memeriksa sinkronisasinya.

### Terjemahan dan pengujian kompatibilitas

Kamus UI berada di `assets/js/i18n/`. Gunakan key semantik dan parameter yang
sama untuk Indonesia/Inggris; jangan menerjemahkan nilai metadata pengguna,
identifier format, atau key laporan mesin. Perubahan bahasa harus memperbarui
tampilan tanpa mereset form atau pekerjaan batch. Modul bahasa ikut precache;
perubahan CSS tetap memerlukan `npm run build:css`.

`tests/compat/README.md` menjelaskan harness browser yang menjalankan
`MetadataClient`, worker, adapter, dan WASM produksi menggunakan fixture sintetis.
Fixture dan generatornya didokumentasikan di `tests/fixtures/README.md`.

**Compatibility setelah perbaikan: 38/38 pemeriksaan lolos dalam 19 job.**
Baseline awal adalah 25/33, kemudian 22/33 saat tiga test UI bergantung pada
teks Indonesia. Harness kini menguji UI ID/EN secara eksplisit, memakai proses
terisolasi per grup format dengan batas paralel default 2. Gunakan
`--concurrency 1` untuk serial atau `COMPAT_CONCURRENCY=4` untuk mesin yang kuat.
Beban ekstra utamanya RAM/CPU dan transfer aset localhost, bukan internet.

Relokasi offset diterima hanya dengan bukti hash payload yang identik; fixture
TIFF dan MP4/MOV/M4A juga diperiksa independen melalui FFmpeg/ffprobe. Cover Ogg
dipertahankan lengkap, vendor FLAC dipulihkan, dan vendor Ogg yang berubah tetap
ditampilkan sebagai peringatan. Durasi MKV fixture diperbaiki tanpa memperlebar
toleransi. Pola timing yang belum dapat dipertahankan (termasuk contoh AAC
audio-only/audio+video dan timestamp tertentu) **ditolak**, bukan dianggap sukses.
Jumlah pemeriksaan mencakup assertion penolakan aman ini, bukan jaminan semua
berkas bisa ditulis. Lihat rincian dan batas bukti di `tests/compat/README.md`.

Fixture PDF bertanda tangan self-signed divalidasi terpisah menggunakan OpenSSL
dan `pdfsig`: setelah edit, byte Contents tanda tangan masih ada, tetapi byte
yang ditandatangani berubah dan validitas tanda tangan hilang. Mempertahankan
Contents **bukan** mempertahankan validitas kriptografis.

---

## Lisensi

**Kode aplikasi:** [AGPLv3](./LICENSE) — Copyright (C) 2026 mifada2543

**Source:** [https://github.com/mifada2543/meinsert](https://github.com/mifada2543/meinsert) · tautan **Source** juga ada di footer setiap halaman (kewajiban transparansi AGPL §13).

**Pemberitahuan:** [NOTICE.md](./NOTICE.md) (Indonesia) · [NOTICE-en.md](./NOTICE-en.md) (English) — ringkasan lisensi, atribusi pihak ketiga, copyleft jaringan, dan aturan merek dagang.

### Atribusi pihak ketiga

Library pihak ketiga yang dibundel tetap pada lisensi aslinya — lihat [assets/THIRD_PARTY_LICENSES.md](./assets/THIRD_PARTY_LICENSES.md):

- **ExifTool 13.60** oleh Phil Harvey — Perl Artistic License atau GPL (teks hak cipta di `assets/vendor/licenses/exiftool-LICENSE.txt`)
- **@colorhythm/exiftool-wasm v1.0.5** — Apache-2.0, plus **zeroperl** (MIT) sebagai runtime WASM-nya
- **Mediabunny** — MPL-2.0 · **pdf-lib**, **browser-id3-writer**, **fflate** — MIT (+ dependensi tersembunyi pdf-lib: pako MIT AND Zlib, standard-fonts/upng MIT, tslib 0BSD)
- **Font IBM Plex** — SIL Open Font License 1.1 (`assets/fonts/OFL.txt`)
- **Gambar merek** — karya asli proyek ini; provenance di [assets/img/PROVENANCE.md](./assets/img/PROVENANCE.md)

Nama ExifTool, Mediabunny, pdf-lib, IBM Plex, dan zeroperl adalah merek dagang pemiliknya; penyebutan di sini hanya untuk identifikasi asal kode, bukan dukungan resmi.

### Lisensi & Monetisasi (AGPLv3)

MeInsert **boleh dimonetisasi** (produk berbayar, hosting berbayar, layanan premium). Syaratnya, AGPLv3 bersifat *copyleft jaringan*:

- Anda boleh mengenakan biaya untuk distribusi, dukungan, atau layanan.
- Saat mendistribusikan perangkat lunak yang tercakup, sediakan **Corresponding Source** sesuai ketentuan AGPLv3 yang berlaku.
- Jika Anda memodifikasi Program dan versi tersebut mendukung interaksi jaringan jarak jauh, pasal 13 mewajibkan penawaran yang jelas kepada pengguna yang berinteraksi dari jarak jauh untuk memperoleh Corresponding Source versi tersebut secara gratis melalui cara yang lazim.
- Modifikasi privat saja tidak mewajibkan publikasi ke umum. Kewajiban berlaku pada karya yang tercakup, bukan otomatis pada perangkat lunak independen yang digunakan bersamanya.
- Kontribusi pihak ketiga di atas tetap tunduk pada lisensinya masing-masing; AGPL tidak mengubahnya.

Ringkasnya: **monetisasi boleh; kewajiban berbagi sumber yang berlaku tetap harus dipenuhi.** Teks [LICENSE](./LICENSE) yang mengikat; ringkasan ini hanya penjelasan bahasa sederhana.

### Catatan penggunaan yang pantas

MeInsert hanya menyediakan *alat* untuk membaca/menulis tag standar (EXIF, XMP, IPTC, ID3, Vorbis Comment, Matroska, Info Dictionary PDF). Anda bertanggung jawab atas file milik Anda: jangan menghapus atau memalsukan atribusi hak cipta pemilik karya, dan patuhi hukum setempat tentang penghapusan informasi manajemen hak cipta.

## Kebijakan Penggunaan dan Privasi

- **Kebijakan Penggunaan:** [Halaman ID/EN](Terms.html) · sumber [Indonesia](TERMS.md) / [English](TERMS-en.md).
- **Kebijakan Privasi:** [Halaman ID/EN](privacy.html) · sumber [Indonesia](PRIVACY.md) / [English](PRIVACY-en.md).

**Isi berkas, metadata yang diedit, sampul, dan hasil pemrosesan tidak dikirim
atau diunggah ke server oleh aplikasi resmi.** Baca kebijakan privasi untuk alur
pemrosesan lokal, cache/preferensi browser, unduhan, serta perbedaan dengan log
akses hosting saat memuat situs.

**Pemalsuan untuk menipu atau melakukan pelanggaran hukum dilarang.** Pelanggaran
yang terbukti dapat dikenai sanksi pidana, perdata, dan/atau administratif sesuai
hukum dan proses pihak berwenang; MeInsert tidak menjatuhkan hukuman otomatis.
Kebijakan penggunaan tidak menambahkan pembatasan pada lisensi AGPL.

---

<div align="center">

**MeInsert** — Dibuat untuk file yang ingin tetap privat.

_Tidak ada backend · Tidak ada upload · 100% di perangkat Anda_

[⬆ Kembali ke atas](#meinsert)

</div>
