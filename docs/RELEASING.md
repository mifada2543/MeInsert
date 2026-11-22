<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Release checklist / Checklist rilis

[English](#english) · [Bahasa Indonesia](#bahasa-indonesia)

MeInsert is static: there is no build step at deploy time. A release still
requires several version markers to move together, or users receive a stale
service worker, an old CSS bundle, or a mismatched badge.

| Phase | Go to |
|---|---|
| Align versions before tagging | [Version sync](#version-sync) |
| Run the required checks | [Pre-release](#pre-release) |
| Publish to each host | [Deploy and host](#deploy-and-host) |
| Verify after publishing | [Post-release](#post-release) |

---

## English

### Version sync

| Marker | Location | Rule |
|---|---|---|
| `version` | `package.json` | Source of truth for the release version. |
| `version` | `package-lock.json` | Root and `packages[""]` must match `package.json`. |
| Version badge | `README.md` and `README-en.md` | Badge must show the same version; parity test enforces it. |
| `CACHE_VERSION` | `sw.js` | Shell cache. Bump together with `CURRENT_VERSION`. |
| `CURRENT_VERSION` | `assets/js/core/build.js` | Must equal `CACHE_VERSION` exactly. |
| `ENGINE_VERSION` | `sw.js` and `build.js` | Optional engine cache. Change only when the engine format changes. |
| `app.bundle.css` | `assets/css/` | Regenerate with `npm run build:css` when CSS sources change. |
| Policy pages | `*.md` sources to generated HTML | Regenerate with `npm run build:policies`. |
| `CHANGELOG.md` | repository root | Add the release entry and update the table of contents. |

Bump `CACHE_VERSION` and `CURRENT_VERSION` together when shell asset *content*
changes. Adding a URL to `SHELL_URLS` does not always need a bump, because
editing `sw.js` already triggers `install`. The list `KNOWN_OPTIONAL_URLS` must
equal the union of `OFFLINE_FEATURES[*].urls`; the offline manifest test checks
this.

### Pre-release

```bash
git status --short
npm ci
npm run test:fast
npm run check:assets
node --test tests/unit/readme-parity.test.js
npm run test:e2e:all
npm run test:compat
```

- [ ] The target version is set in `package.json` and both lock file fields.
- [ ] Both README badges show that version.
- [ ] `CACHE_VERSION` equals `CURRENT_VERSION`; `ENGINE_VERSION` is consistent.
- [ ] CSS and policy generators were run when their sources changed.
- [ ] New known losses are recorded in
      [LIMITATIONS.md](LIMITATIONS.md).
- [ ] `CHANGELOG.md` and [launch notes](launch-notes.md) are updated.
- [ ] No new DNS or hosting change is required by the release.

### Deploy and host

| Host | Header file in use |
|---|---|
| Apache, XAMPP, cPanel | `.htaccess` |
| Netlify, Cloudflare Pages | `_headers` |
| GitHub Pages | Neither; CSP is delivered through a `meta` tag |

Keep `/sw.js` out of long-lived edge caches; a stale worker is the most common
deployment problem. Do not change `CNAME`, which holds the custom domain. Serve
`.wasm` and `.mjs` with correct MIME types so engines can load. Full details are
in [deployment.md](deployment.md).

### Post-release

- [ ] The version tag matches `package.json`.
- [ ] The live PWA picks up the new worker without re-downloading unchanged
      engines.
- [ ] An open, edit, save flow was checked in more than one browser, with the
      Network panel still showing same-origin requests only.
- [ ] [Launch notes](launch-notes.md) are used by the owner for repository
      metadata and announcements; CI never publishes those drafts.

### Policy note

The production host injects a Cloudflare Analytics beacon that is not in this
repository. The CSP blocks it intentionally so the no-analytics claim stays
accurate. This is a behavior change the host owner must know about. Adding an
exception would invalidate the privacy claim. See
[security.md](security.md#important-note-for-the-host-owner).

### Related

[Documentation map](README.md) · [Testing](TESTING.md) ·
[Deployment](deployment.md) · [Changelog](../CHANGELOG.md)

---

## Bahasa Indonesia

### Sinkronisasi versi

| Penanda | Lokasi | Aturan |
|---|---|---|
| `version` | `package.json` | Sumber kebenaran versi rilis. |
| `version` | `package-lock.json` | Bagian root dan `packages[""]` harus sama dengan `package.json`. |
| Badge versi | `README.md` dan `README-en.md` | Badge harus menampilkan versi yang sama; diuji oleh tes parity. |
| `CACHE_VERSION` | `sw.js` | Cache shell. Naikkan bersama `CURRENT_VERSION`. |
| `CURRENT_VERSION` | `assets/js/core/build.js` | Harus sama persis dengan `CACHE_VERSION`. |
| `ENGINE_VERSION` | `sw.js` dan `build.js` | Cache engine opsional. Berubah hanya bila format engine berubah. |
| `app.bundle.css` | `assets/css/` | Regenerasi dengan `npm run build:css` bila sumber CSS berubah. |
| Halaman kebijakan | sumber `*.md` ke HTML | Regenerasi dengan `npm run build:policies`. |
| `CHANGELOG.md` | root repositori | Tambah entri rilis dan perbarui daftar isi. |

Naikkan `CACHE_VERSION` dan `CURRENT_VERSION` bersamaan saat *isi* aset shell
berubah. Menambah URL ke `SHELL_URLS` tidak selalu perlu bump, karena mengubah
`sw.js` sudah memicu `install`. `KNOWN_OPTIONAL_URLS` harus sama dengan gabungan
`OFFLINE_FEATURES[*].urls`; tes manifest offline memeriksanya.

### Pra-rilis

```bash
git status --short
npm ci
npm run test:fast
npm run check:assets
node --test tests/unit/readme-parity.test.js
npm run test:e2e:all
npm run test:compat
```

- [ ] Versi target sudah ditetapkan di `package.json` dan dua field lock file.
- [ ] Kedua badge README menampilkan versi tersebut.
- [ ] `CACHE_VERSION` sama dengan `CURRENT_VERSION`; `ENGINE_VERSION` konsisten.
- [ ] Generator CSS dan kebijakan dijalankan bila sumbernya berubah.
- [ ] Kehilangan data baru dicatat di
      [LIMITATIONS.md](LIMITATIONS.md).
- [ ] `CHANGELOG.md` dan [catatan peluncuran](launch-notes.md) diperbarui.
- [ ] Tidak ada perubahan DNS atau hosting yang disyaratkan rilis ini.

### Deploy dan hosting

| Host | File header yang dipakai |
|---|---|
| Apache, XAMPP, cPanel | `.htaccess` |
| Netlify, Cloudflare Pages | `_headers` |
| GitHub Pages | Keduanya diabaikan; CSP lewat tag `meta` |

Jangan biarkan `/sw.js` di-cache edge terlalu lama; worker basi adalah masalah
deploy paling umum. Jangan ubah `CNAME`, yang berisi domain kustom. Sajikan
`.wasm` dan `.mjs` dengan MIME type yang benar agar engine bisa dimuat. Rincian
lengkap ada di [deployment.md](deployment.md).

### Pasca-rilis

- [ ] Tag versi sesuai dengan `package.json`.
- [ ] PWA live mengambil worker baru tanpa mengunduh ulang engine yang tidak
      berubah.
- [ ] Alur buka, edit, save sudah dicek di lebih dari satu browser, dengan
      Network tetap hanya menampilkan permintaan same-origin.
- [ ] [Catatan peluncuran](launch-notes.md) dipakai owner untuk metadata repo
      dan pengumuman; CI tidak pernah mempublikasikan draf tersebut.

### Catatan kebijakan

Host produksi menyuntikkan beacon Cloudflare Analytics yang tidak ada di
repository ini. CSP memblokirnya secara sengaja agar klaim tanpa analitik tetap
benar. Ini perubahan perilaku yang wajib diketahui owner. Menambah pengecualian
akan membatalkan klaim privasi. Lihat
[security.md](security.md#catatan-penting-untuk-pemilik-host).

### Terkait

[Peta dokumentasi](README.md) · [Pengujian](TESTING.md) ·
[Deployment](deployment.md) · [Catatan perubahan](../CHANGELOG.md)
