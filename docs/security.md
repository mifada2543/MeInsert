<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Cara memverifikasi klaim lokal / How to verify the local-only claim

MeInsert berjanji: **Tidak ada server. Tidak ada upload. Tidak ada akun.**
Berikut cara membuktikannya sendiri — bukan sekadar mempercayai tulisan ini.

MeInsert promises: **No server. No uploads. No account.** Here is how to verify
that claim yourself, rather than taking this page's word for it.

## 1. DevTools Network saat open → edit → save

Buka DevTools (F12) → tab **Network**, lalu jalankan alur nyata:

1. Buka `single.html` atau `batch.html`.
2. Pilih berkas dari perangkat Anda.
3. Ubah salah satu field, misalnya **Judul / Title**.
4. Klik **Simpan / Save**, tinjau perubahan, lalu konfirmasi.
5. Unduh hasilnya.

Sepanjang alur itu, panel Network hanya boleh menampilkan permintaan ke
**origin yang sama** dengan halaman (mis. `https://meinsert.my.id/...` di
produksi, atau `http://localhost/...` di XAMPP), plus URL `blob:` dan `data:`
untuk pratinjau dan unduhan. Tidak boleh ada permintaan ke domain analitik,
CDN, atau endpoint upload mana pun.

Open DevTools (F12) → **Network** tab, then run a real flow:

1. Open `single.html` or `batch.html`.
2. Pick a file from your device.
3. Edit a field such as **Title**.
4. Click **Save**, review the changes, and confirm.
5. Download the result.

Throughout that flow, the Network panel must show only requests to the
**same origin** as the page (for example `https://meinsert.my.id/...` in
production or `http://localhost/...` on XAMPP), plus `blob:` and `data:` URLs
for previews and downloads. There must be no request to any analytics domain,
CDN, or upload endpoint.

Automated check (local server + Chromium):

```bash
node tests/e2e/security.mjs
```

The script asserts the CSP on all five HTML pages and fails if either the
single-file or the batch open → edit → save flow makes a request to any other
origin. Exit status 0 and `PASS:` lines mean the audit succeeded.

## 2. Mode pesawat setelah kunjungan pertama

Buka MeInsert sekali saat masih online dan biarkan service worker selesai
menyimpan app shell. Setelah itu aktifkan **mode pesawat / airplane mode** dan:

- buka beranda, `single.html`, dan `batch.html`;
- pilih berkas, edit metadata, simpan, dan unduh hasilnya.

Semua langkah tetap berjalan tanpa jaringan karena pemrosesan terjadi di
perangkat. Jika sebuah format engine (mis. ExifTool WASM) belum pernah dimuat
sebelum mode pesawat aktif, engine itu perlu diunduh sekali saat masih online.

Load MeInsert once while online and let the service worker finish caching the
app shell. Then turn on **airplane mode** and open the home page, `single.html`,
and `batch.html`, edit a file, save, and download. Everything still works
because processing happens on the device. A format engine that has never been
loaded before (for example the ExifTool WASM runtime) still needs one online
download first.

## 3. CSP membuat permintaan eksternal mustahil

Kelima halaman HTML memuat meta CSP berikut:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'self' blob:; child-src 'self' blob:
```

`connect-src 'self'` berarti browser menolak semua `fetch`, `XMLHttpRequest`,
WebSocket, dan `EventSource` ke origin lain — bukan hanya "tidak kami tulis",
tetapi **tidak diizinkan oleh kebijakan**. `wasm-unsafe-eval` diperlukan agar
runtime WASM tetap bisa dijalankan; `frame-src blob:` diperlukan untuk
pratinjau PDF. Tidak ada `'unsafe-inline'` dan tidak ada CDN eksternal.

All five HTML pages carry the meta CSP above. `connect-src 'self'` makes the
browser refuse every `fetch`, `XMLHttpRequest`, WebSocket, and `EventSource`
to another origin: not merely "we did not write it", but **forbidden by
policy**. `wasm-unsafe-eval` is required to run the WASM runtime and
`frame-src blob:` is required for PDF previews. There is no `'unsafe-inline'`
and no external CDN.

## 4. Audit otomatis: method/body/query & Service Worker nyata

Dua skrip E2E melengkapi pemeriksaan manual di atas:

```bash
node tests/e2e/security.mjs       # CSP + asal + bentuk request
npm run test:offline:real          # Service Worker sungguhan + Cache Storage
```

`security.mjs` tetap memeriksa CSP di kelima halaman dan menolak request lintas
origin. Selain itu, untuk alur open → edit → save (single **dan** batch) skrip
mengaudit **setiap request**: tidak boleh ada `POST`/`PUT`/`PATCH`/`DELETE`,
tidak boleh ada body, tidak boleh ada content-type upload, dan tidak boleh ada
query string yang membawa nilai field atau nama berkas. Dengan demikian tes
mendeteksi "upload" walaupun endpoint-nya masih origin yang sama.

`offline-real.mjs` menjalankan Chrome dengan `serviceWorkers: 'allow'`
terhadap server lokal dan mengukur unduhan lewat event `request` Playwright
**serta** isi `caches.keys()`/`cache.keys()` — bukan hanya teks status di UI.
Skenarionya: (a) kunjungan pertama frugal hanya meng-precache shell, tanpa
WASM/vendor berat; (b) edit MP3 hanya mengunduh engine audio; (c) pasang satu
engine lewat panel Penyimpanan & Offline; (d) instal penuh; (e) reload dan edit
saat offline sungguhan; (f) pembaruan aplikasi tanpa mengunduh ulang WASM yang
tidak berubah; (g) hapus engine opsional. Skrip juga memastikan tidak pernah
ada URL `blob:`/`data:` atau berkas pengguna di Cache Storage. Skenario yang
tidak dapat dijalankan tanpa memanipulasi SW secara merusak isolasi dicetak
sebagai `SKIP:` dengan alasan — bukan `PASS`.

Two E2E scripts extend the manual checks above. `security.mjs` keeps the CSP
and cross-origin checks and additionally audits the **shape** of every request
during single and batch open → edit → save: no mutating methods, no body, no
upload content-type, and no query parameter carrying field values or file
names. `offline-real.mjs` runs Chrome with real service workers against a local
server and measures downloads through Playwright request events **and** Cache
Storage inspection, not UI status text. It covers first frugal visit, MP3 edit,
selective engine install, full install, genuinely offline reload/edit, an app
update that must not re-download unchanged WASM, and optional-engine removal.
No blob/object URL or user file is ever written to Cache Storage; any
infeasible scenario is reported as `SKIP:` with an explicit reason.

### Batasan / Limitations

- Server dan berkas uji bersifat lokal dan sintetis; skrip tidak menguji host
  produksi, beacon CDN/analitik yang disuntikkan host, atau HTTPS publik.
- "Offline" disimulasikan dengan `context.setOffline(true)`, bukan benar-benar
  mematikan radio perangkat; Service Worker harus tetap berada di origin aman
  (`localhost`/`127.0.0.1` memenuhi syarat).
- Skenario pembaruan (f) menyimulasikan deployment dengan melayani `sw.js` dan
  `build.js` yang dimodifikasi **dari server tes** — tidak ada file aplikasi
  yang diubah. Ini membuktikan pemisahan cache shell/engine, bukan proses rilis
  produksi yang sebenarnya.
- Hasil bergantung pada versi Chrome/Playwright; `SKIP` adalah hasil yang sah
  dan tetap dilaporkan, bukan dianggap lulus.

## Catatan penting untuk pemilik host / Important note for the host owner

**Host produksi menyuntikkan beacon Cloudflare Analytics yang TIDAK ada di
repository ini.** CSP baru akan memblokirnya. Ini disengaja: tanpa beacon itu,
klaim "tanpa analitik" menjadi benar secara teknis. Namun ini adalah
**perubahan perilaku** — pemilik host harus mengetahui bahwa data analitik
dari host tidak lagi terkumpul di halaman MeInsert. Jika kami menambahkan
pengecualian untuk beacon tersebut, klaim privasi tidak lagi dapat
dipertahankan dan pengecualian itu harus dihapus dari daftar ini.

**The production host injects a Cloudflare Analytics beacon that is not in
this repository.** The new CSP will block it. This is intentional: blocking it
makes the "no analytics" claim accurate. It is nonetheless a **behavior
change** — the host owner must know that analytics data from the host will no
longer be collected on MeInsert pages. Adding an exception for that beacon
would invalidate the privacy claim and must be removed from this list.

The static files served by the host never receive user files; see
[SECURITY.md](../SECURITY.md) for private vulnerability reporting.
