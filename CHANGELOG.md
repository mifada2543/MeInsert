<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Changelog

Semua perubahan penting dicatat di sini. Versi mengikuti SemVer.

## [main — setelah v1.3.0]

Perubahan ini **sudah ter-push** ke `mifada2543/main` (komit `7f519a9`–`94cec19`); `git pull` dari remote sudah mengambil semuanya. Yang belum ada hanyalah tag/versi rilis baru, sehingga `package.json` dan badge README masih `v1.3.0` dan cache tetap `meinsert-v50`.

### Pengalaman pengguna
- Halaman **Tentang MeInsert** (`about.html`) merangkum prinsip, format, dan tautan kebijakan untuk pengguna baru.
- Pemberitahuan kebijakan sekali konfirmasi (**Mengerti**, disimpan 30 hari) di beranda, editor satu file, dan batch.
- Menu ☰ di layar ≤700px: tombol tema, ID/EN, dan **Penyimpanan & Offline** pindah ke menu; ikon menu berubah menjadi ✕ saat terbuka dan ikon tiap aksi dibedakan.
- Pengaturan **Penyimpanan & Offline**: *Hemat* (default), *Siap sebagian*, *Unduh semuanya*; Save-Data memaksa mode hemat.
- Action bar editor dan footer batch jadi kompak pinned dengan panel **Opsi**; policy notice tidak menutup panel tersebut.
- Chip kapabilitas format, scroll reveal (kecuali kartu dukungan agar tidak menimpa panel), dan animasi buka/tutup pratinjau yang tidak memutus putar media.
- Dukungan dokumen Office OOXML/ODF (docx/xlsx/pptx/docm/xlsm/pptm/odt/ods/odp) dengan patch ZIP terarah dan verifikasi byte-preservation.

### Keandalan & infrastruktur
- Perbaikan Ctrl+R: registrasi SW dengan `updateViaCache: 'none'`, navigasi network-first + fallback cache; cache `meinsert-v50` (`CACHE_VERSION` = `CURRENT_VERSION`).
- Satu proses Chrome bersama untuk seluruh suite E2E lewat CDP; CI membagi 16 suite ke 4 runner paralel dan melewati `apt-get` bila ffmpeg/openssl sudah tersedia.
- Dokumentasi disegarkan: fitur bersihkan metadata tidak lagi ditandai "segera hadir", README ID/EN lebih ramah pemula, arsitektur SW dan daftar script diperbarui.

### Verifikasi
- 218 unit test, 16/16 suite E2E, 48/48 kasus kompatibilitas, lint, `check:css`, `check:policies`.

## [1.3.0] — 2026-11-18

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
- Keputusan: beacon Cloudflare Web Analytics **sengaja diblokir** CSP. Pengendali trafic (WAF/rate limiting/cache) tidak terpengaruh karena berjalan di edge; angka kunjungan diambil dari Cloudflare Dashboard → Analytics → Traffic. Klaim "tanpa analytics" tetap benar.

### Fase 2 — Pengalaman & performa
- Progres unduh ExifTool WASM melalui opsi `fetch` yang sudah didukung library vendor (tanpa mengubah `assets/vendor/**`), dengan status error + tombol coba lagi.
- Prefetch WASM saat idle, hormati `navigator.connection.saveData` dan koneksi lambat; dijadwalkan dari halaman home, single, dan batch.
- Pemetaan `RangeError`/OOM dari worker ke pesan ramah tanpa menyembunyikan error atau kode aslinya.
- Quick save pada editor tunggal (default nonaktif, tersimpan di `localStorage`), hanya untuk perubahan field standar; verifikasi pasca-tulis dan tampilan hasil tetap berjalan.
- Seret file/folder rekursif di batch dengan batas kedalaman 8 dan 500 file; tetap melalui `validateSelection`.
- Perbaikan aksesibilitas: target skip link, fokus dialog, navigasi panah tablist, nama/deskripsi toggle yang terakses.

### Fase 3 — Bersihkan metadata
- Enti baru di halaman home (`?clean=1`) dan tombol manual di editor: profil **Privasi**, **Hapus semua yang aman**, dan **Kustom** per kategori.
- Ringkasan **sebelum → sesudah** per kategori, daftar tag sensitif (termasuk koordinat GPS), dan daftar tag yang sengaja dipertahankan.
- Klasifier murni `assets/js/core/privacy-categories.js` menghasilkan payload standar yang dipahami `buildChangePlan` — **tidak ada jalur tulis paralel**.
- Tag yang dipertahankan: orientasi gambar, struktur/durasi/stream, format, serta tag sistem/generated. "Hapus semua" adalah allowlist penghapusan aman, bukan hapus segalanya.
- Mode batch: aksi bersih per profil untuk file terpilih, terhubung ke review/apply yang ada; laporan JSON/CSV menambah `removedCategories` dan `removedTagCount`.
- Fixture `tests/fixtures/clean-gps.jpg` berisi IFD GPS nyata + generator deterministik; E2E membuktikan koordinat hilang dan gambar tetap valid.
- Perbaikan `assets/js/formats/image.js`: grup `GPS:` kini ikut dikumpulkan sebagai raw tag sehingga classifier melihat koordinat.

### Perubahan umum
- Versi `package.json`/lock → `1.3.0`; badge README ID/EN → `v1.3.0`.
- `CACHE_VERSION` (`sw.js`) dan `CURRENT_VERSION` (`assets/js/core/build.js`) → `meinsert-v45` (nilai sama; kemudian dinaikkan ke `meinsert-v50` di `main`).
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
