<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Security Policy / Kebijakan Keamanan

[English](#english) · [Bahasa Indonesia](#bahasa-indonesia)

| | |
|---|---|
| **Report privately** | [Open a private security advisory](https://github.com/mifada2543/meinsert/security/advisories/new) |
| **Do not** | Open a public issue for a security bug |
| **Machine-readable contact** | [`security.txt`](.well-known/security.txt) |

---

## English

MeInsert is a **fully client-side** metadata editor. There is no backend, no
upload endpoint, and no account. Files you open are read, edited, verified, and
downloaded entirely inside your browser.

### Supported versions

| Version | Supported |
|---|---|
| Latest release (`v1.3.x` and newer) | Yes |
| `main` branch (development) | Yes |
| Older releases | No — please update to the latest release first |

Security fixes land on `main` and are included in the next release.

### Reporting a vulnerability

> [!IMPORTANT]
> Please report privately. Do not open a public issue for a security bug.

Use GitHub's private vulnerability reporting:
[github.com/mifada2543/meinsert/security/advisories/new](https://github.com/mifada2543/meinsert/security/advisories/new).

The advisory form keeps the report visible only to the maintainer until a fix
is published. Do not invent or use an email address; the advisory form is the
only supported channel.

### What to include

- A clear description of the issue and its impact.
- Affected version or commit, and the browser/OS where it reproduces.
- Step-by-step reproduction, including any fixture or sample file needed.
- Whether the issue can be triggered without user interaction.
- Any suggested mitigation or fix, if you have one.

Please do **not** attach real personal files. Use a small synthetic fixture
(`tests/fixtures/` contains suitable samples).

### Response expectations

| Stage | Target |
|---|---|
| Acknowledgement | Best effort within 7 days |
| Status updates | At least once every 14 days while the report is being investigated |
| Fix and disclosure | A fix is prepared on `main` and released, then the advisory is published with credit to the reporter (unless you prefer to stay anonymous) |

Reports that are out of scope, duplicates, or not security issues may be closed
with an explanation.

### Scope

**In scope:** the static application in this repository — HTML pages, ES
modules, Web Workers, bundled WASM/vendor code, service worker, PWA manifest,
and the build/test scripts — plus any issue that would let a file's contents
leave the device or let one origin affect another.

**Out of scope:** the hosting provider's own infrastructure, DNS, third-party
library vulnerabilities that are already fixed in the bundled version, and
social engineering.

The server that serves these static files **never receives user files** — there
is no code path that uploads file contents, edited metadata, cover art, or
processing results. Hosting access logs generated when loading the site are a
separate matter and are described in [PRIVACY-en.md](PRIVACY-en.md).

The Content-Security-Policy meta tag on every page enforces
`connect-src 'self'`, so the application itself cannot make requests to any
other origin. See [docs/security.md](docs/security.md) for how to verify this.

---

## Bahasa Indonesia

MeInsert adalah editor metadata **100% sisi klien**. Tidak ada backend,
endpoint upload, atau akun. Berkas yang Anda buka dibaca, diedit, diverifikasi,
dan diunduh seluruhnya di dalam browser Anda.

### Versi yang didukung

| Versi | Didukung |
|---|---|
| Rilis terbaru (`v1.3.x` dan yang lebih baru) | Ya |
| Branch `main` (pengembangan) | Ya |
| Rilis lama | Tidak — perbarui ke rilis terbaru terlebih dahulu |

Perbaikan keamanan masuk ke `main` dan disertakan pada rilis berikutnya.

### Melaporkan kerentanan

> [!IMPORTANT]
> Mohon laporkan secara privat. Jangan membuka issue publik untuk bug keamanan.

Gunakan fitur pelaporan kerentanan privat GitHub:
[github.com/mifada2543/meinsert/security/advisories/new](https://github.com/mifada2543/meinsert/security/advisories/new).

Formulir advisory menjaga laporan hanya terlihat oleh maintainer sampai
perbaikan dipublikasikan. Jangan membuat atau memakai alamat email; formulir
advisory adalah satu-satunya kanal yang didukung.

### Yang perlu disertakan

- Deskripsi masalah dan dampaknya yang jelas.
- Versi atau komit yang terdampak, serta browser/OS tempat masalah muncul.
- Langkah reproduksi bertahap, termasuk fixture atau berkas contoh yang
  diperlukan.
- Apakah masalah dapat dipicu tanpa interaksi pengguna.
- Saran mitigasi atau perbaikan, jika ada.

Mohon **jangan** melampirkan berkas pribadi yang asli. Gunakan fixture sintetis
berukuran kecil (`tests/fixtures/` berisi contoh yang sesuai).

### Ekspektasi respons

| Tahap | Target |
|---|---|
| Konfirmasi penerimaan | Upaya terbaik dalam 7 hari |
| Pembaruan status | Minimal setiap 14 hari selama laporan diselidiki |
| Perbaikan dan pengungkapan | Perbaikan disiapkan di `main` dan dirilis, lalu advisory dipublikasikan dengan kredit kepada pelapor (kecuali Anda memilih anonim) |

Laporan yang di luar cakupan, duplikat, atau bukan masalah keamanan dapat
ditutup disertai penjelasan.

### Cakupan

**Dalam cakupan:** aplikasi statis di repositori ini — halaman HTML, modul ES,
Web Worker, kode WASM/vendor yang dibundel, service worker, manifest PWA, dan
skrip build/uji — serta setiap masalah yang memungkinkan isi berkas keluar dari
perangkat atau memungkinkan satu origin memengaruhi origin lain.

**Di luar cakupan:** infrastruktur penyedia hosting itu sendiri, DNS, kerentanan
library pihak ketiga yang sudah diperbaiki pada versi yang dibundel, dan
rekayasa sosial.

Server yang menyajikan berkas statis ini **tidak pernah menerima berkas
pengguna** — tidak ada jalur kode yang mengunggah isi berkas, metadata yang
diedit, sampul, atau hasil pemrosesan. Log akses hosting yang timbul saat
memuat situs adalah hal terpisah dan dijelaskan di [PRIVACY.md](PRIVACY.md).

Meta tag Content-Security-Policy pada setiap halaman memberlakukan
`connect-src 'self'`, sehingga aplikasi sendiri tidak dapat mengirim permintaan
ke origin lain. Lihat [docs/security.md](docs/security.md) untuk cara
memverifikasinya.
