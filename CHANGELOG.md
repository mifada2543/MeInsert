<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Changelog

Semua perubahan penting pada proyek ini dicatat di sini. Format mengacu pada
[Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan penomoran versi
mengikuti [Semantic Versioning](https://semver.org/lang/id/).

## Daftar isi

- [1.5.0 — 2026-11-21](#150--2026-11-21)
- [1.4.1 — 2026-11-21](#141--2026-11-21)
- [1.4.0 — 2026-11-21](#140--2026-11-21)
- [1.3.0 — 2026-11-18](#130--2026-11-18)

## [1.5.0] — 2026-11-21

Rilis ini menambahkan pemotongan rentang audio/video, panel riwayat perubahan,
dan penyempurnaan ikon serta kartu preferensi subtitle ke editor satu berkas.
`package.json`, lock file, dan badge README ID/EN menunjukkan `v1.5.0`. Cache
shell naik ke `meinsert-v61`; cache engine tetap `meinsert-engine-v1`.

### Fitur — potong audio/video

- Tombol **Potong audio/video** muncul di panel opsi action bar hanya untuk
  MP3, FLAC, OGG/Opus, MP4/M4A, MOV, MKV, dan WebM; mode (audio/video) dikunci
  dari ekstensi berkas dan diperbarui saat berkas selesai dibuka.
- Dialog potong dua kolom menampilkan pratinjau `blob:` berbasis `<audio>` /
  `<video>`, input waktu `mm:ss.mmm`, tombol tandai mulai/selesai dari posisi
  putar, putar rentang, atur ulang, terapkan, dan batal. Pratinjau dan URL
  objek dilepaskan saat dialog ditutup.
- Dua mode: **Salin** (default, stream-copy bila keyframe mengizinkan) dan
  **Presisi** (batas waktu eksak, dapat melakukan transcode). Ringkasan durasi
  hasil, rencana rentang, dan peringatan keyframe/transcode/bab/Xing/memori
  ditampilkan sebelum penerapan.
- Rentang divalidasi dengan `core/media-cut.js#normalizeTrim` terhadap durasi
  media; rentang tidak valid ditolak dengan toast dan pesan status. Penerapan
  masuk ke undo/redo sebagai perubahan `trim` melalui `setTrim()` dan
  `syncActionBar()`.
- Guard offline dipulihkan: fitur audio memakai paket offline `audio`, video
  memakai `image`; mesin yang belum ter-cache menampilkan toast dan memblokir
  dialog saat offline.

### Fitur — riwayat perubahan & kerapian ikon

- Tombol **Riwayat perubahan** ditaruh di kepala kartu editor, berdampingan
  dengan **Urungkan** / **Ulangkan**. Panel mencatat semua aksi yang masuk undo
  (field, tag kustom, sampul, tag mentah, pembersihan metadata, lirik/subtitle,
  potong, dan nama hasil) dengan label manusiawi dan waktu.
- Memilih entri lalu **Kembali ke versi ini** meminta konfirmasi terlebih
  dahulu. Rollback dapat dibatalkan dengan **Urungkan** (Ctrl+Z); riwayat
  berlaku untuk sesi editing saat ini dan tidak disimpan lintas reload.
- Tombol **Lirik & Subtitle** memakai ikon caption, tombol **Potong** memakai
  ikon gunting. Keduanya berukuran 16×16, tidak berganti ikon mengikuti mode
  berkas, sehingga tampil simetris dan mudah dibedakan.
- Kartu pengaturan tampilan subtitle kini memakai kartu ringkas bergaya kartu
  cue: toolbar **+ Baris** / gear / **Tampilkan: Subtitle** tetap terlihat,
  semua kontrol (tema, warna teks/latar, opacity, ukuran, tebal/bayang, posisi,
  perataan) dirapikan menjadi baris-baris kompak, dan tombol bawah tetap
  **Simpan preferensi**.

### Dokumentasi & offline

- `docs/ARCHITECTURE.md` mendokumentasikan `state.trim`, operasi potong, panel
  riwayat, range proof, dan kebijakan memori pada langkah pipeline 5/7/8.
- `docs/LIMITATIONS.md` menambahkan bagian "Cut audio/video" untuk keyframe,
  transcode, chapter/attachment, Xing/TLEN/CHAP/CTOC, dan memori.
- `media-cut.js`, `mp3-cut.js`, dan dependensinya masuk ke manifest offline
  audio/image; `KNOWN_OPTIONAL_URLS` Service Worker mengikuti union manifest.
- Skrip `test:cut`, `test:history`, dan `test:timed-text` ditambahkan untuk
  suite E2E potong media, riwayat perubahan, dan editor teks berirama.

### Verifikasi rilis

- ESLint 0 error, 439 unit test, `check:css`, `check:policies`, dan
  `check:assets` hijau.
- 20/20 suite E2E lolos dengan satu Chrome bersama, termasuk `cut-media`,
  `change-history`, dan `timed-text`.
- Audit `test:offline:real` lolos: shell terpasang offline, engine cache
  dipertahankan saat pembaruan, dan tidak ada request keluar origin.

## [1.4.1] — 2026-11-21

Rilis ini menambahkan editor teks berirama, memperketat preservasi metadata,
dan menurunkan puncak memori pada alur baca/tulis. `package.json`, lock file,
dan badge README ID/EN menunjukkan `v1.4.1`. Cache shell naik ke
`meinsert-v58`; cache engine tetap `meinsert-engine-v1`.

### Fitur — lirik & subtitle

- Editor dua kolom berbasis ekstensi: audio membuka editor lirik dengan
  pratinjau karaoke, video membuka editor subtitle dengan tata lanskap paksa,
  pratinjau layar penuh, serta tombol ciutkan/buka pratinjau.
- Tombol aksi hanya muncul untuk format audio/video. Teks tersinkron ditulis ke
  `SYLT` (MP3), komentar `LYRICS` (FLAC/OGG/Opus), `©lyr` + WebVTT (MP4), dan
  track WebVTT (MKV/WebM); file `.vtt` tetap bisa diekspor.
- Preferensi tampilan warna/latar/ukuran/posisi hanya tersedia untuk subtitle
  video (LRC tidak menyimpan warna), tersimpan di `localStorage`, dengan kartu
  pengaturan, overlay gelap, dan konfirmasi saat belum disimpan.
- Draf baris tersimpan otomatis dan dihapus setelah **Terapkan**.

### Preservasi metadata & UX

- Patch ID3v2.3/v2.4 tingkat byte yang **operation-aware**: hanya frame yang
  benar-benar diedit yang ditulis ulang. Frame lain — termasuk `COMM`, `APIC`,
  `TXXX` ganda, `PRIV`, `CHAP`, `CTOC`, dan frame biner tak dikenal — disalin apa
  adanya; fallback disertai peringatan untuk tag v2.2/rusak.
- Perbaikan regresi: mengubah hanya `TIT2` tidak lagi menggabungkan dua `COMM`
  menjadi satu; mengubah satu cover/komentar tidak menghapus instance lain.
- Comment header Ogg/Opus ditimpa per rentang `Blob.slice()` dan tetap
  diverifikasi penuh; fallback remux dipertahankan untuk kasus multi-page.
- File picker satu file kini mencantumkan semua format Office seperti mode
  Batch; regression test menjaga kedua daftar tetap sinkron.

### Performa & verifikasi

- Instrumentasi opsional `?mem=1` mencatat puncak payload worker; estimasi
  memori memakai puncak teramati. Payload `ArrayBuffer` ditransfer, bukan
  disalin dua kali. Batch menyarankan mode hemat memori otomatis dan melepaskan
  snapshot setelah verifikasi integritas.
- Kebijakan memori kini konsisten di semua jalur simpan: `ok` normal, `warn`
  peringatan yang bisa diabaikan, `block` memerlukan mode hemat memori (batch)
  atau konfirmasi risiko eksplisit (satu file). Quick-save tidak bisa
  melewatinya.

### Verifikasi rilis

- **402 unit test**, `check:assets`/CSS/policy hijau, **48/48** kasus
  kompatibilitas, **18/18** suite E2E browser, offline Service Worker nyata,
  validator independen audio/Office (0 kegagalan), dan audit independen 24/24.
- Regression test baru untuk preservasi multi-instance ID3 mencakup `COMM`,
  `APIC`, `TXXX`, frame tak dikenal, `PRIV`, edit selektif, v2.3/v2.4, siklus
  berulang, dan fallback tag rusak.

## [1.4.0] — 2026-11-21

Rilis ini merangkum seluruh perubahan yang sebelumnya tertunda di `main`.
`package.json`, lock file, dan badge README ID/EN kini menunjukkan `v1.4.0`.
Cache shell naik ke `meinsert-v57`; cache engine tetap `meinsert-engine-v1`.
Daftar disusun dari yang terbaru ke yang terlama.

### Dokumentasi

- Menambah `docs/README.md` sebagai peta dokumentasi, `docs/TROUBLESHOOTING.md`,
  `docs/TESTING.md`, dan `docs/RELEASING.md` sesuai panduan gaya di
  `docs/STYLE-GUIDE.md`.
- Menghubungkan keempat dokumen tersebut dari README ID/EN, `CONTRIBUTING.md`,
  dan daftar dokumentasi; urutan heading dan tautan `docs/*.md` kedua README
  tetap sinkron.
- Menambah entri rilis ini dan memperbarui daftar isi `CHANGELOG.md`.

### Eksperimen 2 — gzip-only hardening

- Decoder wajib cocok ukuran WASM upstream dan SHA-256 jika Web Crypto tersedia; fallback tanpa Web Crypto memvalidasi struktur WASM.
- Profil gambar mencakup fflate; estimasi gabungan tidak menghitung aset bersama dua kali. Indikator kesiapan diperbarui ketika status cache berubah.
- Service Worker v55 memigrasikan WASM lama yang lolos SHA-256 ke key gzip tanpa download; jika CompressionStream tidak tersedia, cache menyimpan respons raw terverifikasi pada key baru. Aset production tetap gzip-only.
- Regression test menggunakan binary upstream asli dari gzip, bukan header WASM sintetis. Test browser tidak memerlukan aset raw di checkout.

### Hardening lokal — build #17

- XML Office menolak prefix tidak terikat, entity ilegal, atribut duplikat berdasarkan namespace, teks di luar root, dan tag penutup rusak; resolusi prefix mengikuti scope aktif.
- Validasi part utama Office dipisah dari batas preview 2 MiB dan mengikuti relationship package; batas keamanan ZIP dan parser tetap berlaku.
- Cache engine menggunakan progress byte selama transfer, deduplikasi fetch, dan reuse cache runtime. Shell v53; engine v1 dipertahankan. Progress byte menghitung body setelah decoding HTTP, bukan kuota jaringan aktual.
- Pengujian tambahan: XML adversarial, relationship nonstandar, dan stream cache dengan mock Service Worker. Browser E2E masih perlu dijalankan pada environment dengan Playwright.
- Kompresi aset `assets/img/`: WebP (FFmpeg q90) menggantikan ikon PWA, WebP lossless menggantikan logo, JPEG q85 menggantikan OG; PNG tetap hanya untuk `apple-touch-icon` dan `favicon` yang memang butuh kompatibilitas luas. Total **513.437 → 56.814 byte (-88,9%)** untuk 7 file (dulu 7 file 513 KB, sempat 9 file 185 KB karena turunan WebP disimpan ganda). Tidak ada format duplikat lagi. Ikon PWA kini ikut di-precache shell. Shell `meinsert-v54`, engine tetap `meinsert-engine-v1`.
- QA release validation: 313 unit, E2E/offline-real dengan Service Worker nyata, verifikasi independen Office/Media (LibreOffice, FFmpeg/FFprobe, xmllint), fuzz deterministik 240 kasus, dan pengukuran memori/transfer. Tidak ada defect produk yang terkonfirmasi; 2 kasus Ogg multi-page Vorbis **BLOCKED** karena FFprobe tidak dapat mendecode fixture buatan (adapter menolak aman).

### Setelah v1.3.0 (di `main`)

Perubahan ini sudah ter-push ke `mifada2543/main` (komit `7f519a9`–`94cec19`).
Shell cache `meinsert-v52` dan engine cache `meinsert-engine-v1` kini memiliki
siklus hidup terpisah.

#### Pengalaman pengguna
- Halaman **Tentang MeInsert** (`about.html`) merangkum prinsip, format, dan tautan kebijakan untuk pengguna baru.
- Pemberitahuan kebijakan sekali konfirmasi (**Mengerti**, disimpan 30 hari) di beranda, editor satu file, dan batch.
- Menu ☰ di layar ≤700px: tombol tema, ID/EN, dan **Penyimpanan & Offline** pindah ke menu; ikon menu berubah menjadi ✕ saat terbuka dan ikon tiap aksi dibedakan.
- Pengaturan **Penyimpanan & Offline**: *Hemat* (default), *Siap sebagian*, *Unduh semuanya*; Save-Data memaksa mode hemat.
- Action bar editor dan footer batch jadi kompak pinned dengan panel **Opsi**; policy notice tidak menutup panel tersebut.
- Chip kapabilitas format, scroll reveal (kecuali kartu dukungan agar tidak menimpa panel), dan animasi buka/tutup pratinjau yang tidak memutus putar media.
- Dukungan dokumen Office OOXML/ODF (docx/xlsx/pptx/docm/xlsm/pptm/odt/ods/odp) dengan patch ZIP terarah dan verifikasi byte-preservation.
- Pratinjau Office: kartu ringkasan dari metadata yang sudah dibaca (judul, pembuat, jumlah halaman/slide/kata, status tanda tangan/makro) di editor tunggal dan batch — tanpa renderer berat dan tanpa menyesatkan sebagai tampilan isi halaman.
- Halaman About desktop disusun ulang: hero penuh lebar dan kartu tersebar dalam tiga kolom; ikon "Banyak file" kini dua lembar bertumpuk.

#### Keandalan dan infrastruktur
- Perbaikan Ctrl+R: registrasi SW dengan `updateViaCache: 'none'`, navigasi network-first + fallback cache; shell `meinsert-v52` (`CACHE_VERSION` = `CURRENT_VERSION`) dan engine `meinsert-engine-v1` yang dipertahankan lintas update aplikasi.

#### Hardening hasil audit lanjutan
- Deteksi Office memakai **ZIP central directory** (modul `core/zip-directory.js`), sehingga arsip ber-prefix tetap dikenali dari isi; ZIP biasa yang diganti nama `.docx` ditolak sebagai `NOT_OFFICE_PACKAGE`.
- Parser metadata Office **namespace-aware**: prefix alternatif (`d:` untuk `dc:`) tetap terbaca dan ditulis tanpa menambah elemen ber-prefix tak terdeklarasi.
- Validasi struktur package OOXML/ODF, deteksi tanda tangan ODF, serta proteksi ZIP bomb (batas entri, ukuran, rasio kompresi, dan central directory) sebelum dekompresi.
- Custom properties Office kini ditulis native ke `docProps/custom.xml` (OOXML) atau `meta:user-defined` (ODF), lengkap dengan content type dan relationship.
- Cuplikan isi Office terbatas (~280 karakter: paragraf awal, nama sheet, atau teks slide pertama) ditampilkan di bawah ringkasan metadata bila tersedia.
- Ogg Vorbis/Opus: penulisan metadata kini mematch comment packet secara langsung—termasuk menumbuhkan halaman Ogg bila perlu—tanpa mengubah packet audio, sequence, granule, atau CRC. Fallback engine diberi warning eksplisit bila tidak feasible.
- `write` pada adapter audio/video mengembalikan `info` hasil baca ulang blob output, menghilangkan `STRUCTURE_LOST` palsu untuk sample rate/channel.
- Offline: dependency engine diverifikasi dengan test closure statis; E2E Service Worker nyata mengukur request/cache (frugal, MP3, selektif, penuh, offline, update, uninstall) dan security test memeriksa method/body/query selain origin.

#### Hardening fase II (akar masalah)
- XML Office diproses oleh parser namespace-aware mandiri (`core/office-xml.js`) yang bekerja di Worker tanpa `DOMParser`: resolusi URI + local name, prefix alternatif/default, shadowing, entitas numerik, Unicode, DTD/entitas eksternal ditolak. Edit bersifat bedah sehingga atribut (`xsi:type`), komentar, dan elemen asing tetap utuh.
- Validasi paket semantik (`core/office-package.js`): `[Content_Types].xml`, `_rels/.rels`, part dokumen utama dari relationship, content type, akar XML, dan namespace harus konsisten; ODF memvalidasi manifest, mimetype, dan `content.xml`. Ini adalah validasi **struktural/XML**, bukan klaim konformitas skema Office penuh.
- Deteksi ZIP kini hanya membaca tail EOCD, central directory, dan `mimetype` lewat `Blob.slice()` (tidak `file.arrayBuffer()`); dekompresi hanya untuk part metadata/preview dengan batas aktual memakai buffer `out` fflate, bukan hanya ukuran yang dideklarasikan.
- Nama duplikat/path traversal/overlap rentang dan ZIP64 ditolak; media tidak pernah di-inflate saat inspeksi.
- Bagian metadata yang dibuat ulang kini mendaftarkan content type + relationship (OOXML) atau entri manifest (ODF); custom property mempertahankan tipe `vt:*` yang ada.
- `rawRemove` kini memuat semua metadata part sebelum mencocokkan tag; penghapusan field dan `rawRemove` yang menyasar elemen sama tidak lagi menghasilkan edit XML yang tumpang tindih (menutup kegagalan alur "Bersihkan Metadata").
- Test portabilitas: Ogg proof memakai `os.tmpdir()` + `mkdtemp()` dan dibersihkan. Semua harness verifikasi independen dipindahkan ke `tests/independent/` dan memakai path relatif repositori; artefak dibuat di direktori sementara OS lalu dihapus. Didaftarkan sebagai `npm run test:audit`, `test:independent:office`, dan `test:independent:audio`.
- Ogg: edge case comment panjang/Unicode/kunci duplikat, CRC korup, stream terpotong, dan chained stream diuji; decoded audio diverifikasi dengan FFmpeg.
- Offline: closure dependency kini memindai import statis **dan dinamis** (`browser-id3-writer.mjs`, `engines/exiftool.js`, `office-xml.js`, `office-package.js` termasuk); `cacheOptional` memakai cache yang sudah valid, dedup konkuren, job id, dan timeout inactivity 60 detik yang di-reset oleh progress (bukan timeout total 30 detik). Pesan SW divalidasi terhadap allowlist 26 URL; URL arbitrari/blob/data ditolak.
- Perbaikan hang CI `offline-real`: precache shell memakai `AbortController` 15 detik per URL sehingga `registration.update()` tidak menunggu fetch yang macet; simulasi update di E2E dibatasi 60 detik dengan log stage dan `SKIP` eksplisit bila update tidak teramati; job CI diberi `timeout-minutes: 15`.

#### Verifikasi hardening fase II
- 292 unit test (termasuk fuzz namespace/ZIP deterministik), lint, `check:css`, `check:policies`.
- 9 dokumen Office hasil edit: **53/53 bagian XML lolos `xmllint --noout`**; **9/9 dikonversi LibreOffice headless** tanpa error.
- Compat **48/48**; deteksi ZIP hanya **131.420 byte** dari file 2.101.785 byte (~6,25%), `file.arrayBuffer()` = 0.

#### Verifikasi hardening
- 250 unit test, lint, `check:css`, `check:policies`.
- Audit mandiri 24/24: 16 roundtrip format, prefix namespace, padded ZIP, generic ZIP rejection, ODF signature, integritas Ogg/Opus/MP3/MKV.
- FFprobe/FFmpeg development-only: durasi `0.250000` (Vorbis) dan `0.256500` (Opus) identik sebelum/sesudah; decoded MD5 identik (`af0c2520…` dan `8f1304dd…`).
- E2E: 16 suite + `offline-real` dengan Service Worker aktif; compat 48/48.
- Catatan batas: comment baru yang membutuhkan >255 lacing segment masih jatuh ke engine dengan warning; FLAC-in-Ogg/Speex dan stream multi-page tidak dipatch langsung.
- Satu proses Chrome bersama untuk seluruh suite E2E lewat CDP; CI membagi 16 suite ke 4 runner paralel dan melewati `apt-get` bila ffmpeg/openssl sudah tersedia.
- Dokumentasi disegarkan: fitur bersihkan metadata tidak lagi ditandai "segera hadir", README ID/EN lebih ramah pemula, arsitektur SW dan daftar script diperbarui.

#### Verifikasi tahap UI
- 218 unit test, 16/16 suite E2E, 48/48 kasus kompatibilitas, lint, `check:css`, `check:policies`.

## [1.3.0] — 2026-11-18

Rilis stabil pertama dengan fitur bersihkan metadata, hardening keamanan, dan
perbaikan pengalaman pengguna.

### Fase 0 — Kebersihan repositori
- Hapus `probe-tmp.mjs` (skrip debug dengan path Chrome hardcode; tidak ada referensi).
- Tambah `CONTRIBUTING.md`, template issue/PR di `.github/`, serta `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`, `docs/launch-notes.md`.
- `CONTRIBUTING.md` mendokumentasikan arti penanda *reference build* sebagai penanda provenance non-fungsional (bukan tes; jangan dihapus massal).
- README ID/EN dipecah: ringkasan 30 detik di atas, detail ke `docs/`. `tests/unit/readme-parity.test.js` menjaga struktur kedua README tetap sinkron.

### Fase 1 — Keamanan & hardening
- Meta CSP ketat di `index.html`, `single.html`, `batch.html`, `privacy.html`, `Terms.html`: `script-src 'self' 'wasm-unsafe-eval'`, `connect-src 'self'`, `frame-src 'self' blob:`, tanpa `'unsafe-inline'`.
- Template `scripts/build-policies.mjs` juga memuat CSP agar halaman kebijakan hasil generate tetap konsisten.
- `tests/e2e/security.mjs` membuktikan tidak ada request non-same-origin saat open → edit → save di mode single maupun batch.
- Tambah `SECURITY.md`, `.well-known/security.txt`, `_headers`, `docs/security.md`, `docs/deployment.md`.
- Keputusan: beacon Cloudflare Web Analytics **sengaja diblokir** CSP. Pengendali trafik (WAF/rate limiting/cache) tidak terpengaruh karena berjalan di edge; angka kunjungan diambil dari Cloudflare Dashboard → Analytics → Traffic. Klaim "tanpa analytics" tetap benar.

### Fase 2 — Pengalaman & performa
- Progres unduh ExifTool WASM melalui opsi `fetch` yang sudah didukung library vendor (tanpa mengubah `assets/vendor/**`), dengan status error + tombol coba lagi.
- Prefetch WASM saat idle, hormati `navigator.connection.saveData` dan koneksi lambat; dijadwalkan dari halaman home, single, dan batch.
- Pemetaan `RangeError`/OOM dari worker ke pesan ramah tanpa menyembunyikan error atau kode aslinya.
- Quick save pada editor tunggal (default nonaktif, tersimpan di `localStorage`), hanya untuk perubahan field standar; verifikasi pasca-tulis dan tampilan hasil tetap berjalan.
- Seret file/folder rekursif di batch dengan batas kedalaman 8 dan 500 file; tetap melalui `validateSelection`.
- Perbaikan aksesibilitas: target skip link, fokus dialog, navigasi panah tablist, nama/deskripsi toggle yang terakses.

### Fase 3 — Bersihkan metadata
- Entri baru di halaman home (`?clean=1`) dan tombol manual di editor: profil **Privasi**, **Hapus semua yang aman**, dan **Kustom** per kategori.
- Ringkasan **sebelum → sesudah** per kategori, daftar tag sensitif (termasuk koordinat GPS), dan daftar tag yang sengaja dipertahankan.
- Klasifier murni `assets/js/core/privacy-categories.js` menghasilkan payload standar yang dipahami `buildChangePlan` — **tidak ada jalur tulis paralel**.
- Tag yang dipertahankan: orientasi gambar, struktur/durasi/stream, format, serta tag sistem/generated. "Hapus semua" adalah allowlist penghapusan aman, bukan hapus segalanya.
- Mode batch: aksi bersih per profil untuk file terpilih, terhubung ke review/apply yang ada; laporan JSON/CSV menambah `removedCategories` dan `removedTagCount`.
- Fixture `tests/fixtures/clean-gps.jpg` berisi IFD GPS nyata + generator deterministik; E2E membuktikan koordinat hilang dan gambar tetap valid.
- Perbaikan `assets/js/formats/image.js`: grup `GPS:` kini ikut dikumpulkan sebagai raw tag sehingga classifier melihat koordinat.

### Perubahan umum
- Versi `package.json`/lock → `1.3.0`; badge README ID/EN → `v1.3.0`.
- `CACHE_VERSION` (`sw.js`) dan `CURRENT_VERSION` (`assets/js/core/build.js`) → `meinsert-v45` (nilai sama; kemudian dinaikkan ke `meinsert-v50`, lalu `meinsert-v51` di `main`).
- Modul offline baru masuk `SHELL_URLS`; bundel CSS di-rebuild dari sumber modular.
- Skrip/CI baru: `test:security`, `test:engine`, `test:quick-save`, `test:clean`, `test:clean:batch`.

### Ditunda
- Fase 4(a–d). Khususnya **simpan langsung ke file asli** (File System Access API) ditunda ke v1.4 karena bertentangan dengan janji bahwa file asli tidak pernah ditimpa.
- Fase 4(a) pratinjau GPS lokal, 4(b) template/CSV massal, dan format audio tambahan (WAV/AIFF, M4B) belum dikerjakan. Dokumen Office OOXML/ODF sudah didukung di komit `88bf6d6`.

### Status
- Rilis v1.3.0 di-commit sebagai `bbf6a6a` dan sudah ter-push ke remote; perbaikan bundel CSS menyusul di `e408bd9`.

### Verifikasi (saat rilis v1.3.0)
- 184 unit test, ESLint 0 error, `check:css` dan `check:policies` lulus.
- E2E: smoke, bilingual, security, undo single, undo batch, engine loading, quick save, clean single, clean batch — semuanya lulus.
- Compatibility: **38/38** kasus lulus.
