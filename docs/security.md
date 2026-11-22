<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Verifying the local-only claim / Memverifikasi klaim lokal

[English](#english) · [Bahasa Indonesia](#bahasa-indonesia)

MeInsert promises: **No server. No uploads. No account.** This page shows how to
verify that claim yourself instead of taking its word for it.

| Check | Effort | What it proves |
|---|---|---|
| [DevTools Network](#1-devtools-network-during-open--edit--save) | Manual, 2 minutes | No request leaves the page's origin during a real edit. |
| [Airplane mode](#2-airplane-mode-after-the-first-visit) | Manual, 1 minute | Everything still works with no network at all. |
| [CSP](#3-the-csp-makes-external-requests-impossible) | Read-only | The browser itself refuses cross-origin requests. |
| [Automated audits](#4-automated-audits) | One command each | Request shape and Cache Storage contents are checked on every run. |

---

## English

### 1. DevTools Network during open → edit → save

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

Timed-text editing follows the same rule: audio/video previews come from
`URL.createObjectURL(file)` (`blob:`), and line drafts and appearance
preferences are written only to `localStorage`
(`meinsert-timed-text-draft-v1-*` and `meinsert-timed-text-style-v1`). No lyric
or subtitle text is uploaded, and the draft is cleared when you press **Apply**.

Automated check (local server + Chromium):

```bash
node tests/e2e/security.mjs
```

The script asserts the CSP on all five HTML pages and fails if either the
single-file or the batch open → edit → save flow makes a request to any other
origin. Exit status 0 and `PASS:` lines mean the audit succeeded.

### 2. Airplane mode after the first visit

Load MeInsert once while online and let the service worker finish caching the
app shell. Then turn on **airplane mode** and:

- open the home page, `single.html`, and `batch.html`;
- pick a file, edit its metadata, save, and download the result.

Everything still works because processing happens on the device. A format engine
that has never been loaded before (for example the ExifTool WASM runtime) still
needs one online download first.

### 3. The CSP makes external requests impossible

All five HTML pages carry the following meta CSP:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'self' blob:; child-src 'self' blob:
```

`connect-src 'self'` makes the browser refuse every `fetch`, `XMLHttpRequest`,
WebSocket, and `EventSource` to another origin: not merely "we did not write
it", but **forbidden by policy**. `wasm-unsafe-eval` is required to run the WASM
runtime and `frame-src blob:` is required for PDF previews. There is no
`'unsafe-inline'` and no external CDN.

### 4. Automated audits

Two E2E scripts extend the manual checks above:

```bash
node tests/e2e/security.mjs       # CSP + origin + request shape
npm run test:offline:real          # real Service Worker + Cache Storage
```

`security.mjs` keeps the CSP and cross-origin checks and additionally audits the
**shape** of every request during single and batch open → edit → save: no
mutating methods (`POST`/`PUT`/`PATCH`/`DELETE`), no body, no upload
content-type, and no query parameter carrying field values or file names. This
catches an "upload" even if its endpoint were on the same origin.

`offline-real.mjs` runs Chrome with real service workers against a local server
and measures downloads through Playwright request events **and** Cache Storage
inspection, not UI status text. It covers:

- a first frugal visit that precaches only the shell;
- an MP3 edit that downloads only the audio engine;
- selective engine install and a full install;
- a genuinely offline reload and edit;
- an app update that must not re-download unchanged WASM;
- optional-engine removal;
- a second identical install that must transfer **0 bytes**;
- a cancelled download that stops immediately;
- rejection of unknown message types, `blob:`/`file:` URLs, and malformed job
  ids.

Real transferred bytes are measured from response `Content-Length` headers. No
`blob:`/`data:` URL or user file is ever written to Cache Storage. Any scenario
that cannot run without breaking isolation is printed as `SKIP:` with a reason,
never as `PASS`.

#### Limitations of the audits

- The server and test files are local and synthetic; the scripts do not test the
  production host, CDN/analytics beacons injected by the host, or public HTTPS.
- "Offline" is simulated with `context.setOffline(true)` rather than by turning
  off a device radio; the Service Worker must still run on a secure origin
  (`localhost`/`127.0.0.1` qualify).
- The update scenario simulates a deployment by serving a modified `sw.js` and
  `build.js` **from the test server**; no application file is changed. It proves
  the shell/engine cache separation, not the real production release process.
- Results depend on the Chrome/Playwright version; `SKIP` is a legitimate
  result and is reported, not counted as a pass.

### Important note for the host owner

> [!WARNING]
> **The production host injects a Cloudflare Analytics beacon that is not in this
> repository.** The CSP blocks it. This is intentional: blocking it makes the
> "no analytics" claim accurate.

It is nonetheless a **behavior change**: the host owner must know that analytics
data from the host will no longer be collected on MeInsert pages. Adding an
exception for that beacon would invalidate the privacy claim and must be
removed from this list.

The static files served by the host never receive user files; see
[SECURITY.md](../SECURITY.md) for private vulnerability reporting.

---

## Bahasa Indonesia

MeInsert berjanji: **Tidak ada server. Tidak ada upload. Tidak ada akun.**
Berikut cara membuktikannya sendiri — bukan sekadar mempercayai tulisan ini.
Ringkasan pemeriksaan ada pada tabel di bagian atas halaman.

### 1. DevTools Network saat open → edit → save

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

Penyuntingan teks berirama mengikuti aturan yang sama: pratinjau audio/video
berasal dari `URL.createObjectURL(file)` (`blob:`), dan draf baris serta
preferensi tampilan hanya ditulis ke `localStorage`
(`meinsert-timed-text-draft-v1-*` dan `meinsert-timed-text-style-v1`). Tidak ada
teks lirik atau subtitle yang diunggah, dan draf dihapus saat Anda menekan
**Terapkan**.

Pemeriksaan otomatis (server lokal + Chromium):

```bash
node tests/e2e/security.mjs
```

Skrip ini memastikan CSP ada di kelima halaman HTML dan gagal bila alur open →
edit → save, baik satu file maupun batch, membuat permintaan ke origin lain.
Status keluar 0 dan baris `PASS:` berarti audit berhasil.

### 2. Mode pesawat setelah kunjungan pertama

Buka MeInsert sekali saat masih online dan biarkan service worker selesai
menyimpan app shell. Setelah itu aktifkan **mode pesawat** dan:

- buka beranda, `single.html`, dan `batch.html`;
- pilih berkas, edit metadata, simpan, dan unduh hasilnya.

Semua langkah tetap berjalan tanpa jaringan karena pemrosesan terjadi di
perangkat. Jika sebuah format engine (mis. ExifTool WASM) belum pernah dimuat
sebelum mode pesawat aktif, engine itu perlu diunduh sekali saat masih online.

### 3. CSP membuat permintaan eksternal mustahil

Kelima halaman HTML memuat meta CSP berikut:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'self' blob:; child-src 'self' blob:
```

`connect-src 'self'` berarti browser menolak semua `fetch`, `XMLHttpRequest`,
WebSocket, dan `EventSource` ke origin lain — bukan hanya "tidak kami tulis",
tetapi **tidak diizinkan oleh kebijakan**. `wasm-unsafe-eval` diperlukan agar
runtime WASM tetap bisa dijalankan; `frame-src blob:` diperlukan untuk
pratinjau PDF. Tidak ada `'unsafe-inline'` dan tidak ada CDN eksternal.

### 4. Audit otomatis

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
Skenarionya:

- kunjungan pertama mode hemat yang hanya meng-precache shell, tanpa WASM/vendor
  berat;
- edit MP3 yang hanya mengunduh engine audio;
- pasang satu engine lewat panel Penyimpanan & Offline, lalu instal penuh;
- reload dan edit saat offline sungguhan;
- pembaruan aplikasi tanpa mengunduh ulang WASM yang tidak berubah;
- hapus engine opsional;
- instal ulang aset yang tidak berubah harus transfer **0 byte**;
- unduhan yang dibatalkan berhenti langsung;
- pesan SW ditolak untuk tipe tak dikenal, URL `blob:`/`file:`, dan `jobId` yang
  salah.

`Content-Length` dari server tes dipakai untuk mengukur byte transfer sungguhan
lewat event `response` Playwright. Skrip juga memastikan tidak pernah ada URL
`blob:`/`data:` atau berkas pengguna di Cache Storage. Skenario yang tidak dapat
dijalankan tanpa merusak isolasi dicetak sebagai `SKIP:` dengan alasan — bukan
`PASS`.

#### Batasan audit

- Server dan berkas uji bersifat lokal dan sintetis; skrip tidak menguji host
  produksi, beacon CDN/analitik yang disuntikkan host, atau HTTPS publik.
- "Offline" disimulasikan dengan `context.setOffline(true)`, bukan benar-benar
  mematikan radio perangkat; Service Worker harus tetap berada di origin aman
  (`localhost`/`127.0.0.1` memenuhi syarat).
- Skenario pembaruan menyimulasikan deployment dengan melayani `sw.js` dan
  `build.js` yang dimodifikasi **dari server tes** — tidak ada file aplikasi
  yang diubah. Ini membuktikan pemisahan cache shell/engine, bukan proses rilis
  produksi yang sebenarnya.
- Hasil bergantung pada versi Chrome/Playwright; `SKIP` adalah hasil yang sah
  dan tetap dilaporkan, bukan dianggap lulus.

### Catatan penting untuk pemilik host

> [!WARNING]
> **Host produksi menyuntikkan beacon Cloudflare Analytics yang TIDAK ada di
> repositori ini.** CSP memblokirnya. Ini disengaja: tanpa beacon itu, klaim
> "tanpa analitik" menjadi benar secara teknis.

Namun ini adalah **perubahan perilaku** — pemilik host harus mengetahui bahwa
data analitik dari host tidak lagi terkumpul di halaman MeInsert. Jika kami
menambahkan pengecualian untuk beacon tersebut, klaim privasi tidak lagi dapat
dipertahankan dan pengecualian itu harus dihapus dari daftar ini.

Berkas statis yang disajikan host tidak pernah menerima berkas pengguna; lihat
[SECURITY.md](../SECURITY.md) untuk pelaporan kerentanan secara privat.
