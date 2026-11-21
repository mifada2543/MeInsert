<div align="center">

<img src="assets/img/icon-512.webp" alt="Logo MeInsert" width="112" height="112" />

# MeInsert

**Edit metadata tanpa upload — 100% di browser.**

Baca dan tulis metadata gambar, PDF, audio, video, dan dokumen Office langsung di perangkat Anda.<br />
Tanpa server. Tanpa upload. Tanpa akun.

**Bahasa Indonesia** · [English](README-en.md)

[Demo langsung](https://meinsert.my.id/) · [Editor satu file](https://meinsert.my.id/single.html) · [Mode batch](https://meinsert.my.id/batch.html) · [Dokumentasi](#dokumentasi-lanjutan)

[![CI](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml/badge.svg)](https://github.com/mifada2543/meinsert/actions/workflows/ci.yml)
[![Versi](https://img.shields.io/badge/version-v1.5.0-blue?style=flat-square)](./package.json)
[![Lisensi](https://img.shields.io/badge/Lisensi-AGPLv3-orange?style=flat-square)](./LICENSE)
[![Client-side](https://img.shields.io/badge/100%25-client--side-lightgrey?style=flat-square)](#cara-memverifikasi-klaim-lokal)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-7B3FF2?style=flat-square)](https://meinsert.my.id/)

![Pratinjau antarmuka MeInsert](assets/img/og-image.jpg)

</div>

## Mulai cepat

Semua mode berjalan di browser Anda, tanpa akun.

| Kebutuhan | Buka | Keterangan |
|---|---|---|
| Edit metadata **satu file** | [Editor satu file](https://meinsert.my.id/single.html) | Field dinamis sesuai format, tag kustom, dan tabel raw tag. |
| Edit **banyak file** sekaligus | [Mode batch](https://meinsert.my.id/batch.html) | Hasil berupa ZIP dan laporan JSON/CSV. |
| **Bersihkan metadata** dari berkas | [Bersihkan metadata](https://meinsert.my.id/index.html?clean=1) | Hapus GPS/EXIF sensitif atau pilih tag per kategori. |

Menjalankan salinan lokal? Lihat [Instalasi cepat](#instalasi-cepat-xampp). Halaman lokal: [`single.html`](./single.html) · [`batch.html`](./batch.html) · [`index.html?clean=1`](./index.html?clean=1).

## Daftar isi

- [Kenapa MeInsert?](#kenapa-meinsert)
- [Format didukung](#format-didukung)
- [Cara pakai](#cara-pakai)
- [Fitur unggulan](#fitur-unggulan)
- [Keterbatasan](#keterbatasan)
- [Bahasa antarmuka](#bahasa-antarmuka)
- [Instalasi cepat (XAMPP)](#instalasi-cepat-xampp)
- [Cara memverifikasi klaim lokal](#cara-memverifikasi-klaim-lokal)
- [Dokumentasi lanjutan](#dokumentasi-lanjutan)
- [Pengembangan](#pengembangan)
- [Lisensi](#lisensi)
- [Kebijakan penggunaan dan privasi](#kebijakan-penggunaan-dan-privasi)

## Kenapa MeInsert?

- **Privasi di perangkat.** Berkas dibaca dan ditulis di browser lewat WebAssembly dan Web Worker. Tidak ada upload ke server mana pun.
- **Ringan dipasang.** Situs statis: tanpa backend dan tanpa langkah build saat deploy. Bisa dijalankan langsung dari XAMPP/Apache.
- **Siap offline.** App shell tersedia offline setelah cache terpasang; engine format dan WASM tersedia offline setelah sekali dimuat.

Satu prinsip untuk tiga kebutuhan: edit satu file, proses massal per grup format, atau bersihkan metadata. Pada mode **bersihkan metadata** Anda dapat memilih profil Privasi, menghapus semua yang aman, atau mengatur sendiri per kategori. Hasilnya tetap ditinjau dan diverifikasi seperti biasa.

Teknologi: JavaScript ES2022 (tanpa framework), WebAssembly, Web Worker, dan Service Worker.

## Format didukung

Format dikenali dari **isi berkas**, bukan hanya ekstensi, sehingga berkas yang salah nama tetap terbaca dengan benar. Hanya field yang relevan yang ditampilkan.

| Kategori | Format | Metode penulisan |
|---|---|---|
| Gambar | JPEG, PNG, WebP, TIFF | XMP + EXIF; IPTC untuk JPEG/TIFF |
| PDF | PDF | Info Dictionary + XMP stream |
| Audio | MP3, FLAC, OGG Vorbis / Opus | ID3v2.3, Vorbis Comment (remux lossless) |
| Video | MP4 / M4A / MOV, MKV / WebM | ItemList + XMP (ExifTool); Matroska SimpleTag (remux lossless) |
| Office | DOCX, XLSX, PPTX, ODT, ODS, ODP | Hanya menambal bagian XML metadata; semua entri ZIP lain diverifikasi byte-for-byte |

Detail teknis dan batas tiap format ada di [dokumentasi keterbatasan](docs/LIMITATIONS.md).

### Sampul / thumbnail

Cover image (JPEG/PNG/WebP hingga 10 MB; GIF/BMP juga untuk MP3, FLAC, OGG/Opus, dan MKV) disematkan secara native per format. Sampul dapat diganti atau dihapus.

| Format | Struktur native |
|---|---|
| MP3 | `APIC` |
| FLAC, OGG, Opus | `METADATA_BLOCK_PICTURE` |
| MP4 / M4A | `covr` (hanya JPEG/PNG/WebP) |
| MKV / WebM | Matroska attachment |

### Lirik & subtitle tersinkron

Tombol **Lirik & Subtitle** di editor membuka editor dua kolom: pratinjau media di kiri dan daftar baris di kanan (mode video memakai tata letak lanskap). Pratinjau memakai media lokal Anda (`blob:`), tanpa upload.

- **Penyuntingan:** ketik teks, tandai waktu langsung di tiap baris, impor (`.lrc`, `.srt`, `.vtt`), dan ekspor teks berirama.
- **Tampilan teks (khusus subtitle/video):** tombol **gear** membuka kartu pengaturan warna teks, warna dan opacity latar, ukuran, tebal, bayang, posisi, dan perataan, termasuk preset **MEeL**. Format LRC tidak menyimpan warna atau latar, sehingga tombol ini tidak tersedia untuk lirik.
- **Perilaku kartu:** saat terbuka, toolbar **+ Baris** / gear ✕ / **Tampilkan: Subtitle** tetap terlihat, isi kartu dirapikan menjadi baris-baris kompak, editor meredup dengan overlay gelap (tanpa blur), dan tombol utama berubah menjadi **Simpan preferensi** (disimpan di `localStorage`); saat tertutup kembali menjadi **Terapkan**. Klik di luar kartu atau tekan gear ✕ untuk menutup; perubahan yang belum disimpan memunculkan pilihan **Batalkan** / **Simpan**.
- **Draf:** baris tersimpan otomatis dan dihapus setelah **Terapkan**.
- **Penyimpanan ke berkas:** teks disisipkan ke dalam kontainer, bukan ke piksel video. Lirik juga bisa menjadi track berlabel "Lirik". File asli tidak pernah ditimpa.

| Format | Tempat penyimpanan |
|---|---|
| MP3 | `SYLT` |
| FLAC, OGG, Opus | Komentar `LYRICS` |
| MP4 / M4A | `©lyr` + track WebVTT |
| MKV / WebM | Track WebVTT |

Blok `STYLE` dan cue settings ikut ditulis. Warna dan latar dijamin pada pratinjau dan file `.vtt`; pemutar internal mungkin berbeda. Detail ada di [dokumentasi keterbatasan](docs/LIMITATIONS.md).

### Potong audio/video

Tombol **Potong audio/video** tersedia di panel opsi action bar untuk MP3, FLAC, OGG/Opus, MP4/M4A, MOV, MKV, dan WebM. Dialog menampilkan pratinjau lokal, input waktu `mm:ss.mmm`, tombol tandai awal/akhir dari posisi putar, serta dua mode:

- **Salin** (default): stream-copy tanpa transcode bila keyframe mengizinkan.
- **Presisi**: batas waktu eksak; dapat melakukan transcode lokal.

Rentang disimpan sebagai perubahan `trim` di editor, ikut undo/redo, dan baru diproses saat Anda menekan **Simpan**. Hasil diverifikasi terhadap bukti rentang media sebelum bisa diunduh; file asli tidak pernah ditimpa. Guard offline memblokir tombol jika paket engine terkait belum ter-cache.

### Riwayat perubahan

Tombol **Riwayat** di kepala kartu editor, berdampingan dengan **Urungkan** / **Ulangkan**, membuka daftar semua aksi pada sesi ini: perubahan field, tag kustom, sampul, tag mentah, pembersihan metadata, lirik/subtitle, potong, dan nama hasil. Tiap entri memuat label dan waktu.

Memilih **Kembali ke versi ini** memunculkan konfirmasi. Setelah rollback, Anda masih bisa menekan **Urungkan** (Ctrl+Z) untuk membatalkan rollback tersebut. Riwayat tidak disimpan lintas reload atau pergantian berkas.

### Dokumen Office

- **Didukung penuh:** DOCX, XLSX, PPTX, serta ODT, ODS, ODP.
- **Best-effort:** varian makro `.docm`, `.xlsm`, `.pptm`. Makro dipertahankan apa adanya (byte-identik), tetapi periksa hasilnya setelah disimpan.
- **Tanda tangan:** mengubah metadata pada dokumen Office bertanda tangan membuat tanda tangannya tidak valid.
- **Tidak didukung:** Office terenkripsi dan format lama `.doc`, `.xls`, `.ppt`.
- Setiap penulisan hanya menambal bagian XML metadata dan memverifikasi semua entri ZIP lainnya byte-for-byte.

## Cara pakai

### 1. Pilih file

Buka beranda, lalu pilih **Satu file** untuk edit satuan atau **Banyak file** untuk batch.

### 2. Edit metadata

Field muncul dinamis sesuai format. Ubah yang Anda butuhkan, tambah **tag kustom**, ganti sampul, atau kosongkan field untuk menghapus tag.

### 3. Simpan dan unduh

Klik **Simpan**, tinjau seluruh perubahan, lalu konfirmasi. Hasil dibaca ulang dan diverifikasi otomatis sebelum Anda mengunduh file baru (atau ZIP untuk batch). File asli tidak pernah ditimpa.

> [!NOTE]
> **Pelacakan perubahan:** hanya perubahan field yang diminta yang dikirim untuk ditulis. Ini bukan jaminan bahwa seluruh tag yang tidak didukung tetap utuh. Ekstensi hasil secara default mengikuti isi terdeteksi; dialog mismatch juga menawarkan pilihan mempertahankan ekstensi asli. Mengganti nama bukan konversi format.

## Fitur unggulan

### Satu file vs batch

| | Satu file | Batch (massal) |
|---|---|---|
| Batas | Maks. 4 GB per file | Video maks. 10 file, audio maks. 20, gambar/PDF maks. 50 |
| Edit | Field dinamis, tag kustom, tabel raw tag + pencarian | Per grup format atau field standar lintas format, pilih file yang diproses, raw tag per file |
| Hasil | Satu file terverifikasi + rename aman | ZIP + laporan JSON/CSV |

### Alur kerja yang aman

- **Review sebelum tulis** — dialog menampilkan seluruh field, tag kustom, raw tag, dan sampul yang berubah; perubahan yang tidak mengubah nilai otomatis dilewati.
- **Verifikasi otomatis** — output dibaca ulang, lalu metadata di luar rencana perubahan dibandingkan sebelum vs sesudah.
- **Tag kustom dan raw tag** — tambah metadata non-standar per format dan cari tag mentah dengan cepat.
- **Undo/redo** — tersedia di editor satu file dan, terpisah, per grup format pada batch.
- **Pratinjau dokumen Office** — kartu ringkasan dari metadata dokumen (judul, pembuat, jumlah, status tanda tangan/makro) membantu memastikan Anda memilih file yang benar. Cuplikan isi terbatas bisa dibuka bila tersedia; ini bukan tampilan isi halaman penuh.

### Pengalaman pengguna

- **Tema gelap/terang** — ikut sistem atau manual, tanpa flicker saat memuat.
- **Pratinjau media kontinu** — mengganti thumbnail atau membatalkan perubahan tidak menghentikan pratinjau audio/video.
- **Pratinjau beranimasi** — buka/tutup halus, tidak menghentikan putar media, dan menghormati pengaturan pengurangan gerak di sistem.
- **Nyaman di layar kecil** — tombol tema, bahasa, dan pengaturan masuk ke menu ☰ (berubah menjadi ✕ saat terbuka); tombol aksi utama tetap terlihat, pengaturan lain ada di panel **Opsi**.
- **Halaman Tentang** — ringkasan prinsip, format yang didukung, dan tautan kebijakan dalam satu halaman ([`about.html`](about.html)).
- **Pemberitahuan kebijakan sekali konfirmasi** — cukup klik **Mengerti**; pilihan Anda disimpan di browser selama 30 hari.

### Offline dan penyimpanan

- **PWA yang dapat dipasang** — pasang ke layar utama; app shell dan dependensi format tersedia offline setelah dimuat sekali.
- **Penyimpanan & Offline** — pilih *Hemat* (default), *Siap sebagian*, atau *Unduh semuanya*. MeInsert otomatis memakai mode hemat jika browser mengaktifkan Save-Data.

## Keterbatasan

MeInsert menulis ulang metadata secara lokal dan memverifikasi hasilnya, tetapi sebagian data tidak dapat dipertahankan. Laporan integritas setelah penulisan adalah hasil otoritatif per file.

- **Ukuran dan memori:** maks. 4 GB per file; estimasi memori puncak memunculkan peringatan. Bila masuk kategori blok, penulisan hanya bisa dilanjutkan lewat mode hemat memori (batch) atau konfirmasi risiko eksplisit (satu file); quick-save tidak bisa melewatinya.
- **Cakupan perubahan:** hanya field yang Anda ubah yang ditulis. Ini bukan janji bahwa semua tag yang tidak didukung tetap utuh.
- **Tanda tangan digital:** mengedit PDF atau dokumen Office bertanda tangan membuat tanda tangannya tidak valid.
- **Format tertentu:** chapter dan attachment MKV/WebM umumnya tidak ikut terbawa; FLAC-in-Ogg dan Speex tidak didukung; PDF terenkripsi tidak didukung dan Office terenkripsi ditolak.
- **Pemutar:** sebagian pemutar tidak menampilkan sampul Ogg/Opus atau warna subtitle yang tertanam.

Rincian lengkap per format: [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Bahasa antarmuka

Pilih **ID** (Indonesia) atau **EN** (English) di header beranda, editor satu file, maupun batch. Di layar kecil (≤700px), tombolnya ada di dalam menu ☰ bersama tombol tema dan **Penyimpanan & Offline**.

- Pilihan disimpan secara lokal dengan kunci `meinsert-language`.
- Tanpa preferensi, bahasa browser Indonesia/Inggris dipakai; bahasa lain memakai Indonesia sebagai fallback.
- Pergantian bahasa tidak memuat ulang halaman dan tidak mengubah file, nilai metadata, atau skema laporan JSON/CSV.
- Dokumentasi: **[Indonesia](README.md)** · **[English](README-en.md)**.

## Instalasi cepat (XAMPP)

Tidak perlu build. File HTML/CSS/JS statis dan library vendor sudah termasuk di repositori.

```bash
# 1. Letakkan salinan di folder htdocs XAMPP Anda, lalu buka di browser
git clone https://github.com/mifada2543/meinsert.git MeInsert
# http://localhost/MeInsert/
```

`npm install` **tidak** diperlukan untuk memakai aplikasi. Perintah `npm install` dan `npm run vendor` hanya dibutuhkan jika Anda **mengembangkan** atau memperbarui library (lihat [CONTRIBUTING.md](CONTRIBUTING.md)).

Gunakan menu browser **Install / Tambahkan ke layar utama** untuk memasang PWA.

> [!NOTE]
> Kunjungan pertama tetap online sampai browser selesai menyimpan halaman dan aset utamanya. Setelah itu halaman bisa dibuka offline. Library vendor dan ExifTool WASM (~27 MB) diambil saat pertama dipakai lalu disimpan. Di pengaturan **Penyimpanan & Offline** Anda bisa memilih mode Hemat, Siap sebagian, atau Unduh semuanya.

Menjalankan server lokal tanpa XAMPP:

```bash
npm run serve  # http://localhost:8000
```

Catatan hosting: `.htaccess` untuk Apache/XAMPP, `_headers` untuk Netlify/Cloudflare Pages, dan GitHub Pages mengabaikan keduanya. Lihat [panduan deployment](docs/deployment.md).

## Cara memverifikasi klaim lokal

1. Buka DevTools → **Network**.
2. Buka file, ubah metadata, lalu simpan.
3. Seharusnya **tidak ada permintaan ke alamat lain**; semua proses terjadi di browser Anda.
4. Setelah kunjungan pertama, aktifkan mode pesawat: halaman dan editor tetap bisa dipakai.

Aturan keamanan konten (`Content-Security-Policy`) juga memblokir permintaan keluar, sehingga pemeriksaan ini bukan sekadar janji.

Panduan lengkap beserta penjelasan beacon analitik host produksi: [docs/security.md](docs/security.md). Pemeriksaan otomatis: `node tests/e2e/security.mjs`.

## Dokumentasi lanjutan

Detail teknis dipisahkan dari README agar halaman ini tetap ringkas.

| Dokumen | Isi |
|---|---|
| [Peta dokumentasi](docs/README.md) | Tempat mulai: dokumen, audiens, dan bahasanya. |
| [Pemecahan masalah](docs/TROUBLESHOOTING.md) | Gejala umum, penyebab, dan tindakan aman. |
| [Panduan pengujian](docs/TESTING.md) | Lapisan tes, perintah, dan variabel lingkungan. |
| [Checklist rilis](docs/RELEASING.md) | Sinkronisasi versi dan cache untuk maintainer. |
| [Arsitektur & struktur proyek](docs/ARCHITECTURE.md) | Alur kerja, modul, worker, dan WASM. |
| [Keterbatasan & temuan kompatibilitas](docs/LIMITATIONS.md) | Batas per format, verifikasi, dan bukti harness. |
| [Verifikasi klaim lokal](docs/security.md) | DevTools, mode pesawat, dan CSP. |
| [Deployment & header hosting](docs/deployment.md) | `.htaccess`, `_headers`, GitHub Pages, dan cache `/sw.js`. |
| [Halaman Tentang](about.html) | Penjelasan singkat untuk pengguna baru. |
| [Catatan peluncuran](docs/launch-notes.md) | Ringkasan rilis. |
| [Panduan kontribusi](CONTRIBUTING.md) | Aturan proyek, skrip npm, dan cara menambah format. |
| [Catatan perubahan](CHANGELOG.md) | Riwayat perubahan. |

## Pengembangan

Prasyarat: Node.js 22. Instal dependensi pengembangan dengan `npm ci`. Aturan kontribusi lengkap ada di [CONTRIBUTING.md](CONTRIBUTING.md).

### Perintah utama

| Perintah | Fungsi |
|---|---|
| `npm run serve` | Server lokal di `http://localhost:8000`. |
| `npm run test:fast` | Gate cepat tanpa browser: unit + lint + CSS + kebijakan. |
| `npm test` | Unit test. |
| `npm run lint` | ESLint. |
| `npm run check:css` | Pastikan bundel CSS sinkron dengan sumber. |
| `npm run check:policies` | Pastikan halaman kebijakan sinkron dengan Markdown. |
| `npm run build:css` | Regenerasi `app.bundle.css`. |
| `npm run build:policies` | Regenerasi halaman kebijakan dari Markdown. |
| `npm run test:e2e` | Smoke test browser (satu suite). |
| `npm run test:e2e:all` | Seluruh suite E2E dalam satu proses Chrome (CDP). |
| `npm run test:compat` | Kasus kompatibilitas dengan fixture nyata. |

CI membagi suite E2E ke 4 runner: `MEINSERT_E2E_SHARD=1/4 npm run test:e2e:all`.

### Suite E2E per fitur

| Perintah | Cakupan |
|---|---|
| `npm run test:preview` | Animasi buka/tutup pratinjau. |
| `npm run test:action-bar` | Action bar dan panel Opsi. |
| `npm run test:about` | Halaman Tentang dan menu mobile. |
| `npm run test:offline` | Pengaturan Penyimpanan & Offline. |
| `npm run test:reveal` | Animasi muncul saat scroll. |
| `npm run test:i18n` | UI bilingual dan offline. |
| `npm run test:undo` · `npm run test:undo:batch` | Undo/redo satu file dan batch. |
| `npm run test:security` | CSP dan audit jaringan. |
| `npm run test:engine` | Unduh dan status engine WASM. |
| `npm run test:wasm-integrity` | E2E WASM dengan Service Worker aktif. |
| `npm run test:timed-text` | Editor lirik/subtitle dan preferensi tampilan. |
| `npm run test:quick-save` | Simpan cepat. |
| `npm run test:clean` | Bersihkan metadata (satu file dan batch). |
| `npm run test:office` | Dokumen Office OOXML/ODF. |

## Lisensi

**Kode aplikasi:** [AGPLv3](./LICENSE) — Copyright (C) 2026 mifada2543.

**Source:** [github.com/mifada2543/meinsert](https://github.com/mifada2543/meinsert). Tautan **Source** juga ada di footer setiap halaman (kewajiban transparansi AGPL §13).

**Pemberitahuan:** [NOTICE.md](./NOTICE.md) (Indonesia) · [NOTICE-en.md](./NOTICE-en.md) (English).

### Atribusi pihak ketiga

Library pihak ketiga yang dibundel tetap berada di bawah lisensi aslinya. Lihat [indeks atribusi](assets/THIRD_PARTY_LICENSES.md).

- **ExifTool 13.60** (Artistic/GPL), **@colorhythm/exiftool-wasm** (Apache-2.0) + **zeroperl** (MIT)
- **Mediabunny** (MPL-2.0), **pdf-lib**, **browser-id3-writer**, **fflate** (MIT)
- **Font IBM Plex** — SIL Open Font License 1.1
- **MEeL — editor LRC & helper teks berirama** (AGPL-3.0, © 2026 Mifada) — kode yang diadaptasi untuk editor lirik/subtitle; daftar file sumber dan tujuan ada di [NOTICE.md](./NOTICE.md) dan [indeks atribusi](assets/THIRD_PARTY_LICENSES.md).
- **Gambar merek** — karya asli proyek; lihat [provenance](assets/img/PROVENANCE.md).

### Lisensi dan monetisasi (AGPLv3)

Monetisasi boleh, tetapi AGPLv3 bersifat *copyleft jaringan*: saat mendistribusikan perangkat lunak tercakup, sediakan **Corresponding Source**. Modifikasi privat tidak otomatis wajib dipublikasikan. Teks [LICENSE](./LICENSE) yang mengikat; ringkasan ini hanya penjelasan sederhana.

### Catatan penggunaan yang pantas

MeInsert hanya menyediakan *alat* untuk membaca dan menulis tag standar. Anda bertanggung jawab atas file milik Anda: jangan menghapus atau memalsukan atribusi hak cipta, dan patuhi hukum setempat.

## Kebijakan penggunaan dan privasi

| Dokumen | Halaman | Sumber |
|---|---|---|
| Kebijakan Penggunaan | [Halaman ID/EN](Terms.html) | [Indonesia](TERMS.md) · [English](TERMS-en.md) |
| Kebijakan Privasi | [Halaman ID/EN](privacy.html) | [Indonesia](PRIVACY.md) · [English](PRIVACY-en.md) |
| Keamanan | [SECURITY.md](SECURITY.md) | [security.txt](.well-known/security.txt) |

**Isi berkas, metadata yang diedit, sampul, dan hasil pemrosesan tidak dikirim atau diunggah ke server oleh aplikasi resmi.** Baca [docs/security.md](docs/security.md) untuk cara memverifikasi klaim tersebut, termasuk catatan tentang beacon analitik yang disuntikkan host produksi.

**Pemalsuan untuk menipu atau melakukan pelanggaran hukum dilarang.** Pelanggaran yang terbukti dapat dikenai sanksi sesuai hukum dan proses pihak berwenang; MeInsert tidak menjatuhkan hukuman otomatis. Kebijakan penggunaan tidak menambahkan pembatasan pada lisensi AGPL.

---

<div align="center">

**MeInsert** — Dibuat untuk file yang ingin tetap privat.

Tidak ada backend · Tidak ada upload · 100% di perangkat Anda

[Kembali ke atas](#meinsert)

</div>
