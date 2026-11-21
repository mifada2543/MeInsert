<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Documentation map / Peta dokumentasi

[English](#english) · [Bahasa Indonesia](#bahasa-indonesia)

The READMEs are deliberately short. This page maps each document to its
audience and language, so readers can jump straight to the depth they need.

| I am... | Start here | Then read |
|---|---|---|
| A new user | [README-en.md](../README-en.md) | [Troubleshooting](TROUBLESHOOTING.md) |
| A contributor | [CONTRIBUTING.md](../CONTRIBUTING.md) | [Architecture](ARCHITECTURE.md), [Testing](TESTING.md) |
| A maintainer | [RELEASING.md](RELEASING.md) | [Deployment](deployment.md), [Security](security.md) |

---

## English

### Where to start

New users should begin with the quick start and the supported-format table in
[README-en.md](../README-en.md). Contributors should read the hard rules in
[CONTRIBUTING.md](../CONTRIBUTING.md) before opening a pull request. Maintainers
use [RELEASING.md](RELEASING.md) for the version-sync checklist and
[deployment.md](deployment.md) for host-specific headers.

### Document map

| Document | Audience | Language | Covers |
|---|---|---|---|
| [README.md](../README.md) | Users | ID | Overview, formats, quick install, policies. |
| [README-en.md](../README-en.md) | Users | EN | The same overview in English. |
| [Troubleshooting](TROUBLESHOOTING.md) | Users, contributors | ID + EN | Symptoms, causes, and safe actions. |
| [Security](security.md) | Everyone | ID + EN | Verifying the no-upload claim. |
| [Deployment](deployment.md) | Hosts, maintainers | ID + EN | Host headers, service worker caching. |
| [Testing](TESTING.md) | Contributors | ID + EN | Test layers, commands, environment variables. |
| [Release checklist](RELEASING.md) | Maintainers | ID + EN | Version and cache sync, pre/post-release. |
| [Architecture](ARCHITECTURE.md) | Contributors | EN | Modules, pipelines, offline strategy. |
| [Limitations](LIMITATIONS.md) | Users, contributors | EN | Per-format limits and known losses. |
| [Style guide](STYLE-GUIDE.md) | Authors | EN | Markdown conventions for this repository. |
| [Launch notes](launch-notes.md) | Owner | EN | Draft repository description and announcements. |
| [Contributing](../CONTRIBUTING.md) | Contributors | EN | Rules, scripts, adding a format. |
| [Changelog](../CHANGELOG.md) | Everyone | ID | Release history. |
| [Security policy](../SECURITY.md) | Reporters | EN | Private vulnerability reporting. |

### Conventions

- Both READMEs must keep the same heading sequence and the same set of
  `docs/*.md` links; `tests/unit/readme-parity.test.js` enforces this.
- Single-file bilingual pages use `## English` and `## Bahasa Indonesia` with
  matching subsection structure. See [STYLE-GUIDE.md](STYLE-GUIDE.md).
- Avoid hard-coded counts that go stale. Point to the defining file instead,
  such as `tests/e2e/run-all.mjs` or `tests/compat/jobs.mjs`.
- Keep the three provenance comment lines on documents and source files.
- Use relative links, and re-check anchors whenever a heading is renamed.

### Related

[Reporting a problem](TROUBLESHOOTING.md#reporting-a-problem) ·
[Issue templates](../.github/ISSUE_TEMPLATE/) ·
[Changelog](../CHANGELOG.md)

---

## Bahasa Indonesia

### Mulai dari mana

Pengguna baru sebaiknya mulai dari "Mulai cepat" dan tabel format yang didukung
di [README.md](../README.md). Kontributor perlu membaca aturan keras di
[CONTRIBUTING.md](../CONTRIBUTING.md) sebelum membuka pull request. Maintainer
memakai [RELEASING.md](RELEASING.md) untuk checklist sinkronisasi versi dan
[deployment.md](deployment.md) untuk header tiap host.

### Peta dokumen

| Dokumen | Audiens | Bahasa | Isi |
|---|---|---|---|
| [README.md](../README.md) | Pengguna | ID | Ringkasan, format, instalasi cepat, kebijakan. |
| [README-en.md](../README-en.md) | Pengguna | EN | Ringkasan yang sama dalam bahasa Inggris. |
| [Pemecahan masalah](TROUBLESHOOTING.md) | Pengguna, kontributor | ID + EN | Gejala, penyebab, dan tindakan aman. |
| [Keamanan](security.md) | Semua orang | ID + EN | Cara membuktikan klaim tanpa upload. |
| [Deployment](deployment.md) | Host, maintainer | ID + EN | Header host, cache service worker. |
| [Pengujian](TESTING.md) | Kontributor | ID + EN | Lapisan tes, perintah, variabel lingkungan. |
| [Checklist rilis](RELEASING.md) | Maintainer | ID + EN | Sinkronisasi versi/cache, pra- dan pasca-rilis. |
| [Arsitektur](ARCHITECTURE.md) | Kontributor | EN | Modul, pipeline, strategi offline. |
| [Keterbatasan](LIMITATIONS.md) | Pengguna, kontributor | EN | Batas per format dan kehilangan yang diketahui. |
| [Panduan gaya](STYLE-GUIDE.md) | Penulis | EN | Konvensi Markdown repositori ini. |
| [Catatan peluncuran](launch-notes.md) | Owner | EN | Draf deskripsi repo dan pengumuman. |
| [Kontribusi](../CONTRIBUTING.md) | Kontributor | EN | Aturan, skrip, cara menambah format. |
| [Catatan perubahan](../CHANGELOG.md) | Semua orang | ID | Riwayat rilis. |
| [Kebijakan keamanan](../SECURITY.md) | Pelapor | EN | Pelaporan kerentanan secara privat. |

### Konvensi

- Kedua README harus memiliki urutan heading dan kumpulan tautan `docs/*.md`
  yang sama; `tests/unit/readme-parity.test.js` memberlakukan aturan ini.
- Halaman bilingual dalam satu file memakai `## English` dan
  `## Bahasa Indonesia` dengan struktur sub-bagian yang sepadan. Lihat
  [STYLE-GUIDE.md](STYLE-GUIDE.md).
- Hindari angka statis yang cepat usang. Rujuk ke file sumbernya, misalnya
  `tests/e2e/run-all.mjs` atau `tests/compat/jobs.mjs`.
- Pertahankan tiga baris komentar provenance di setiap dokumen dan file sumber.
- Pakai tautan relatif, dan periksa ulang anchor saat mengganti nama heading.

### Terkait

[Melaporkan masalah](TROUBLESHOOTING.md#melaporkan-masalah) ·
[Template issue](../.github/ISSUE_TEMPLATE/) ·
[Catatan perubahan](../CHANGELOG.md)
