# Meinsert — Editor Metadata Lokal

**Meinsert** adalah aplikasi web statis untuk membaca dan menulis metadata file langsung di browser. Tidak ada server, tidak ada upload, tidak ada akun — file Anda tidak pernah meninggalkan perangkat.

## Fitur

- **Privasi penuh**: Semua pemrosesan di sisi klien (WebAssembly + Web Workers)
- **Format didukung**:
  - **Gambar**: JPEG, PNG, WebP, TIFF (XMP + EXIF, IPTC untuk JPEG/TIFF)
  - **PDF**: Info Dictionary + XMP stream (halaman & struktur tetap utuh)
  - **Audio**: MP3 (ID3v2.3 via browser-id3-writer), FLAC (Vorbis comment via Mediabunny remux lossless), OGG Vorbis / Opus (Vorbis comment via Mediabunny remux)
  - **Video**: MP4/M4A/MOV (ItemList + XMP via ExifTool), MKV/WebM (Matroska SimpleTag via Mediabunny remux lossless)
- **Deteksi otomatis** berdasarkan magic bytes (bukan hanya ekstensi)
- **Field dinamis** — hanya field yang relevan untuk format file ditampilkan
- **Tag kustom** — tambahkan metadata non-standar per format
- **Thumbnail / Sampul** — embed cover image ke MP3 (APIC), FLAC/OGG/Opus (METADATA_BLOCK_PICTURE), MP4/M4A (covr), MKV/WebM (Matroska attachment); bisa ganti/hapus
- **Dirty tracking** — hanya field yang berubah yang ditulis; mengosongkan field = hapus tag
- **Verifikasi** — hasil dibaca ulang sebelum unduh
- **Rename aman** — nama file hasil bebas diganti, tapi ekstensi dikunci mengikuti format terdeteksi (tidak bisa `.mp3`→`.flac` hanya lewat rename)
- **Tema gelap/terang** — otomatis mengikuti sistem, bisa diubah manual; transisi circular reveal dari tombol + morph ikon sun/moon, dan tema diterapkan sebelum paint pertama (tanpa kedipan)
- **Progressive Web App** — bisa diinstal ke layar utama; setelah kunjungan pertama, aplikasi dan vendor besar (termasuk WASM) tersedia offline
- **Proses massal (batch)** — periksa metadata banyak file, kelola per grup format, pilih file yang benar-benar diproses, hapus raw tag per file, tambah file susulan lewat tombol di dalam grup, lalu unduh hasil sebagai ZIP
- **Laporan batch** — ringkasan JSON/CSV tanpa menyimpan isi file
- **Manajemen memori WASM** — worker dan WebAssembly ExifTool dilepas/dihentikan setelah batch, saat idle, dan saat halaman ditutup
- **Tidak ada dependensi runtime** — file HTML/CSS/JS statis, jalan dari XAMPP/Apache

## Instalasi Cepat (XAMPP)

```bash
# 1. Clone / ekstrak ke htdocs
cd /opt/lampp/htdocs
git clone <repo> Meinsert
cd Meinsert

# 2. Install dependensi vendor (satu kali, atau saat update library)
npm install
npm run vendor

# 3. Buka di browser
# http://localhost/Meinsert/
# Pada browser yang mendukung, gunakan menu Install / Tambahkan ke layar utama.
# Kunjungan pertama tetap online agar service worker bisa mengunduh cache offline (~29 MB).
```

File vendor sudah termasuk di repo (assets/vendor/), jadi `npm run vendor` hanya diperlukan saat update versi library.

## Struktur Proyek

```
Meinsert/
├── index.html                 # Beranda: pilih Satu file / Banyak file
├── single.html                # Editor satu file
├── batch.html                 # Batch: periksa & proses banyak file
├── manifest.json              # PWA manifest
├── sw.js                      # Service worker (precache app + vendor)
├── .htaccess                  # MIME types & cache headers
├── THIRD_PARTY_LICENSES.md    # Lisensi library bundled
├── package.json               # Dev deps & vendor script
├── scripts/
│   └── vendor.mjs             # Copy library dari node_modules → assets/vendor/
├── tests/
│   ├── e2e/smoke.mjs       # Smoke test browser/PWA/batch
│   └── unit/               # Unit test batch limits & report
└── assets/
    ├── css/app.css            # Styling lengkap (responsive, dark mode)
    ├── js/
    │   ├── app.js             # App shell, state, UI orchestration + registrasi SW
    │   ├── core/
    │   │   ├── detector.js    # Magic-bytes detection
    │   │   ├── registry.js    # Adapter registry
    │   │   ├── tag-utils.js   # Normalisasi nilai
    │   │   ├── errors.js      # Error class & serialisasi
    │   │   └── worker-client.js # RPC ke Web Workers + dispose/idle timeout
    │   ├── batch/
    │   │   ├── batch-limits.js    # Batas dinamis batch (video/audio/ringan)
    │   │   ├── batch-processor.js # Scan/apply/cancel batch secara berurutan
    │   │   ├── batch-view.js      # UI batch (grup format, pilih file, raw tags)
    │   │   ├── batch-report.js    # Laporan JSON/CSV
    │   │   └── batch-zip.js       # ZIP streaming via fflate
    │   ├── engines/
    │   │   └── exiftool.js    # Wrapper ExifTool WASM
    │   ├── formats/
    │   │   ├── image.js       # JPEG/PNG/WebP/TIFF adapter
    │   │   ├── pdf.js         # PDF adapter (pdf-lib)
    │   │   ├── mp3.js         # MP3 adapter (Mediabunny read + ID3 writer)
    │   │   ├── flac.js        # FLAC adapter (thin wrapper of vorbis-common)
    │   │   ├── ogg.js         # OGG Vorbis / Opus adapter (thin wrapper of vorbis-common)
    │   │   ├── vorbis-common.js # Shared Vorbis comment read/write logic (FLAC, OGG)
    │   │   ├── mkv.js         # MKV/WebM adapter (Mediabunny remux)
    │   │   └── mp4.js         # MP4 adapter (ExifTool)
    │   ├── ui/
    │   │   ├── dom.js         # Helper DOM
    │   │   ├── icons.js       # SVG inline icons
    │   │   ├── toast.js       # Notifikasi
    │   │   ├── file-card.js   # Preview & info file
    │   │   ├── form-view.js   # Form metadata dinamis
    │   │   ├── raw-view.js    # Tabel tag mentah + search
    │   │   └── result-view.js # Kartu hasil + unduh
    │   └── workers/
    │       ├── rpc.js         # Message handling worker
    │       ├── exiftool.worker.js
    │       ├── media.worker.js
    │       └── pdf.worker.js
    └── vendor/                # Bundled libraries (no build step)
        ├── exiftool-wasm/
        ├── mediabunny.mjs
        ├── pdf-lib.esm.js
        ├── browser-id3-writer.mjs
        ├── fflate.mjs
        └── licenses/
```

## Arsitektur Singkat

1. **PWA** → `sw.js` precache seluruh app + vendor (WASM ikut ter-cache) → offline setelah kunjungan pertama
2. **Deteksi** → `detector.js` baca 128 byte pertama → tentukan format & subtype
3. **Batch** → `batch-view.js` kelompokkan file per format; `batch-processor.js` scan/apply berurutan; `batch-zip.js` buat ZIP; `batch-report.js` buat JSON/CSV
4. **Adapter** → `registry.js` pilih adapter berdasarkan format
5. **Worker** → `worker-client.js` spawn worker per engine (exiftool/media/pdf), dengan dispose/idle timeout/terminate
6. **Read** → Adapter `read(file)` → normalisasi ke field standar + raw tags
7. **UI** → `form-view.js` render field per section, custom tags, raw tab; batch memakai form grup + raw per file
8. **Write** → User klik Simpan → `collectChanges()` → `adapter.write(file, payload)`
9. **Verify** → Adapter baca ulang output → bandingkan field yang diubah
10. **Download** → Blob hasil → `<a download>` click / ZIP untuk batch

**Routing**: tiga halaman statis — `/` (beranda pemilih mode), `/single.html` (editor satu file), `/batch.html` (batch). Header tiap halaman punya tab Satu file / Banyak file; service worker mem-precache ketiganya, jadi semua route bekerja offline.

## Catatan Teknis

- **ExifTool WASM** (~27 MB) di-lazy-load via worker; pertama kali ~1-2 detik
- **PDF**: pdf-lib menulis Info Dictionary + XMP stream fresh (unknown XMP nodes tidak dipertahankan v1)
- **MP3**: browser-id3-writer menghapus tag ID3 lama; tag TXXX non-standar dihapus (dipertahankan hanya yang diketahui)
- **FLAC/OGG/MKV**: Mediabunny remux lossless (`copy: {mode:'forced'}`); video/audio stream hash identik
- **OGG/Opus**: output Ogg membutuhkan `copy.shiftTolerance: Infinity` (paket Ogg pertama punya timestamp negatif karena pre-roll)
- **Cover / thumbnail**: gambar JPEG/PNG/WebP ≤ 10 MB di-embed native per format (APIC / METADATA_BLOCK_PICTURE / covr / Matroska attachment). Untuk mengganti/menghapus, frame/lampiran lama dihapus dari `raw` agar tidak bocor ke output. Cover hanya ditampilkan untuk file audio & video
- **MP4**: ExifTool menulis ItemList + XMP unqualified tags; cover MP4 dibaca via pass tambahan Mediabunny (ExifTool WASM tidak bisa mengembalikan byte binary murni)
- **Custom tags**: Gambar/MP4 pakai native ExifTool tag names; PDF pakai Info dict keys; MP3 pakai TXXX; FLAC/OGG/MKV pakai Vorbis/Matroska keys (uppercase)
- **WASM memory**: `worker-client.js` memakai satu worker per engine, `dispose`/terminate setelah batch, `pagehide`, dan idle timeout (~8 menit). ExifTool WASM juga memanggil `dispose` milik library bila tersedia.
- **Batch raw tags**: Raw tags ditampilkan per file. Tag yang tidak bisa dihapus selektif ditandai dengan gembok; hasil tetap dibaca ulang untuk memberi warning bila tag masih terbaca.

## Keterbatasan v1

- MP3: frame ID3 non-standar (selain yang dipetakan) hilang saat menulis
- MKV: chapter & attachment tidak dipertahankan saat remux
- PDF: XMP stream diganti penuh (unknown namespace hilang); PDF terenkripsi tidak didukung; PDF bertanda tangan digital → tanda tangan invalid
- TIFF: field kamera (make/model/lens) hanya JPEG & TIFF; PNG/WebP hanya XMP/EXIF umum
- Batch: ZIP dibuat di memori browser. Batas dinamis: video maks. 10 file (@ ≤ 1 jam, total ≤ 2 GB), audio maks. 20 file (@ ≤ 30 menit, total ≤ 1 GB), gambar/PDF/ringan maks. 50 file (total ≤ 1 GB). Batch campuran tetap dibatasi per kategori; file dengan durasi tak terbaca dikunci dari batch.
- Batch: edit massal berlaku per grup format/subtype, bukan lintas format; custom tags tidak diedit massal di v1
- Batch: penghapusan raw tag selektif tidak universal. MP3 menghapus frame tak dikenal saat rewrite; tag read-only/turunan tidak bisa dipilih. Tag yang tersisa setelah verifikasi ditandai warning.
- OGG hanya mendukung Vorbis & Opus (FLAC-in-Ogg / Speex ditolak); cover Ogg/Opus tertanam tetapi tidak semua pemutar menampilkannya
- Cover hanya JPEG/PNG/WebP ≤ 10 MB; gambar lain ditolak

## Development

```bash
# Serve lokal (Python 3)
npm run serve  # http://localhost:8000
# atau gunakan Apache/XAMPP: http://localhost/Meinsert/

# Unit test batch limits & laporan
npm test

# Smoke test browser (butuh Chrome/Chromium; override dengan CHROME_BIN bila perlu)
npm run test:e2e

# Update vendor libraries
npm install
npm run vendor

# Lint (opsional)
npx eslint assets/js --ext .js
```

## Lisensi

Kode aplikasi: AGPLv3.
Library pihak ketiga: lihat `THIRD_PARTY_LICENSES.md`.