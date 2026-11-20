<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Deployment / Hosting

MeInsert adalah sekumpulan file statis: tidak ada server aplikasi, database,
atau langkah build saat deploy. Namun aturan header berbeda-beda tiap host.

MeInsert is a set of static files: no application server, no database, and no
build step at deploy time. Header rules, however, differ per host.

## Mana yang berlaku di host Anda / Which file applies where

| Host | File header yang dipakai | Catatan |
|---|---|---|
| Apache / XAMPP / cPanel | `.htaccess` | SATU-SATUNYA yang dibaca Apache. `_headers` diabaikan. |
| Netlify | `_headers` | `.htaccess` diabaikan. |
| Cloudflare Pages | `_headers` | `.htaccess` diabaikan. |
| GitHub Pages | **tidak ada keduanya** | GitHub Pages mengabaikan `_headers` dan tidak menjalankan `.htaccess`. |

- **`.htaccess` hanya berlaku untuk Apache/XAMPP, BUKAN GitHub Pages.**
  Isinya mengatur MIME type `.wasm`, `.mjs`, font, dan cache.
- **`_headers` hanya berlaku untuk Netlify/Cloudflare Pages.** Ini berisi
  `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, MIME type, dan aturan
  cache konservatif.
- **GitHub Pages mengabaikan `_headers`**. Karena itu, Content-Security-Policy
  dikirim sebagai tag `<meta http-equiv="Content-Security-Policy">` di kelima
  halaman HTML. Meta CSP bekerja di semua host, termasuk GitHub Pages.
- **`CNAME` berisi `meinsert.my.id`** dan hanya dipakai GitHub Pages untuk
  custom domain. Jangan mengubahnya saat deploy ke host lain.

- **`.htaccess` applies only to Apache/XAMPP, NOT GitHub Pages.** It sets MIME
  types for `.wasm`, `.mjs`, fonts, and cache rules.
- **`_headers` applies only to Netlify/Cloudflare Pages**, with `nosniff`,
  `no-referrer`, `X-Frame-Options: DENY`, MIME types, and conservative caching.
- **GitHub Pages ignores `_headers`**, so the CSP is delivered as a
  `<meta http-equiv="Content-Security-Policy">` tag on all five HTML pages.
  Meta CSP works on every host, including GitHub Pages.
- **`CNAME` contains `meinsert.my.id`** and is used only by GitHub Pages for
  the custom domain. Do not change it when deploying elsewhere.

**Tidak ada perubahan DNS atau hosting yang menjadi bagian dari pekerjaan
ini.** Tidak ada nama domain baru, tidak ada pemindahan host, tidak ada
perubahan konfigurasi Cloudflare yang disyaratkan oleh perubahan keamanan ini
(kecuali tindakan opsional untuk cache `/sw.js` di bawah).

**No DNS or hosting changes are part of this work.** No new domain, no host
migration, and no required Cloudflare configuration change comes from the
security work described here (apart from the optional `/sw.js` cache action
below).

## Cache service worker di Cloudflare / Service worker caching on Cloudflare

Host saat ini menyajikan `/sw.js` dengan `max-age` panjang **dan** cache edge
Cloudflare. Kombinasi itu menyebabkan masalah worker basi: browser mempertahankan
service worker lama selama beberapa jam, sementara halaman sudah diperbarui.

The current host serves `/sw.js` with a long `max-age` **and** Cloudflare edge
caching. That combination caused stale-worker problems: browsers kept an old
service worker for hours while the pages had already been updated.

Mitigasi:

- `_headers` memuat aturan eksplisit untuk `/sw.js`:
  `Cache-Control: no-cache, no-store, must-revalidate`. Ini berlaku di
  Netlify/Cloudflare Pages.
- Di GitHub Pages, `_headers` diabaikan. Siapkan **Cloudflare Cache Rule** agar
  `/sw.js` tidak di-cache di edge, atau lakukan purge cache setelah setiap
  deploy. `.htaccess` sudah melakukan hal yang setara pada Apache/XAMPP.
- Halaman juga memiliki deteksi worker basi: bila build worker lebih tua dari
  build halaman, halaman memaksa pembaruan lalu menyegarkan diri.

Mitigation:

- `_headers` has an explicit `/sw.js` rule:
  `Cache-Control: no-cache, no-store, must-revalidate`. This applies on
  Netlify/Cloudflare Pages.
- On GitHub Pages `_headers` is ignored: set a **Cloudflare Cache Rule** so
  `/sw.js` is not cached at the edge, or purge the cache after each deploy.
  `.htaccess` already does the equivalent on Apache/XAMPP.
- The pages also detect a stale worker: when the worker build is older than
  the page build, the page forces an update and then refreshes itself.

## Cache shell dan cache engine / Shell and engine caches

Sejak `meinsert-v52`, service worker memakai dua cache yang terpisah:

- `CACHE_VERSION` (`sw.js`, sama dengan `CURRENT_VERSION` di
  `assets/js/core/build.js`) adalah **cache shell**. Naikkan keduanya bersamaan
  saat aset shell berubah.
- `ENGINE_VERSION` (`sw.js`, sama dengan `ENGINE_VERSION` di `build.js`,
  mis. `meinsert-engine-v1`) adalah **cache mesin opsional**. Versi ini
  berdiri sendiri: memperbarui shell tidak membatalkan unduhan mesin yang
  sudah tersimpan, dan menghapus mesin opsional tidak menghapus shell.

`activate` melakukan migrasi sekali dari cache lama `meinsert-v51`: entri yang
bukan bagian dari `SHELL_URLS` disalin ke cache engine sebelum cache lama
dihapus. Hanya cache lama yang cocok pola `meinsert-*` yang dihapus; kedua cache
aktif selalu dipertahankan. Pesan `CACHE_OPTIONAL`, `OPTIONAL_STATUS`, dan
`CLEAR_OPTIONAL` memakai **versi engine**, sedangkan probe `GET_VERSION`
memakai versi shell (dan menyertakan `engineVersion`).

Menambah URL baru ke `SHELL_URLS` tidak selalu membutuhkan bump versi: perubahan
pada `sw.js` sudah memicu `install`, yang meng-precache ulang seluruh
`SHELL_URLS` ke cache dengan nama yang sama. Bump `CACHE_VERSION` **dan**
`CURRENT_VERSION` secara bersamaan saat *isi* aset yang sudah di-cache berubah.
Modul editor teks berirama (`core/timed-text.js` dan
`ui/timed-text-editor.js`) termasuk `SHELL_URLS`, jadi tersedia offline tanpa
unduhan mesin tambahan. Perubahan ukuran file-file audio/video yang tercantum
di `OFFLINE_FEATURES[*].urls` (mis. `mp3.js`, `mkv.js`, `id3-sylt.js`) harus
diikuti pembaruan nilai `bytes` agar tes estimasi offline tetap lolos.

Daftar `KNOWN_OPTIONAL_URLS` di `sw.js` harus sama persis dengan gabungan
`OFFLINE_FEATURES[*].urls`; tes `offline-manifest` memeriksanya. Sebelum
mengunduh, worker memakai ulang entri engine yang memiliki header
`X-MeInsert-Engine-Version` sesuai versi, menduplikasi fetch konkuren, dan
mendukung pembatalan per `jobId`.

Since `meinsert-v52`, the service worker uses two separate caches:

- `CACHE_VERSION` (`sw.js`, equal to `CURRENT_VERSION` in
  `assets/js/core/build.js`) is the **shell cache**. Bump both together when a
  shell asset changes.
- `ENGINE_VERSION` (`sw.js`, equal to `ENGINE_VERSION` in `build.js`, e.g.
  `meinsert-engine-v1`) is the **optional engine cache**. It is versioned
  independently: a shell update does not invalidate engines already downloaded,
  and clearing optional engines never deletes the shell.

`activate` migrates once from the old `meinsert-v51` cache: entries outside
`SHELL_URLS` are copied into the engine cache before the old cache is deleted.
Only stale `meinsert-*` caches are removed; both active caches are preserved.
`CACHE_OPTIONAL`, `OPTIONAL_STATUS`, and `CLEAR_OPTIONAL` messages use the
**engine version**, while the `GET_VERSION` probe uses the shell version (and
also reports `engineVersion`).

Adding a new URL to `SHELL_URLS` does not always require a version bump: editing
`sw.js` already triggers `install`, which re-precaches every `SHELL_URLS` entry
into the same cache name. Bump `CACHE_VERSION` **and** `CURRENT_VERSION` together
when the *content* of an already cached asset changes. `KNOWN_OPTIONAL_URLS` in
`sw.js` must equal the union of `OFFLINE_FEATURES[*].urls` exactly; the
`offline-manifest` test enforces it. Before fetching, the worker reuses an
engine entry carrying `X-MeInsert-Engine-Version` equal to the version,
deduplicates concurrent fetches, and supports cancellation by `jobId`.

## Verifikasi / Verification

```bash
npm run check:policies   # policy HTML masih sinkron
node tests/e2e/security.mjs   # CSP + tidak ada permintaan eksternal
node --test tests/unit/site-url.test.js
```

See [docs/security.md](security.md) for the manual DevTools and airplane-mode
checks, and [SECURITY.md](../SECURITY.md) for reporting security issues.
