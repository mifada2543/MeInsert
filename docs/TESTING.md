<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Testing / Pengujian

[English](#english) · [Bahasa Indonesia](#bahasa-indonesia)

This guide centralizes how to run every test layer in MeInsert. There is no
application server: some checks use `node --test`, some drive a real
Chrome/Chromium over CDP, and some use real-file fixtures.

| Need | Go to |
|---|---|
| A quick local gate before a pull request | [Commands](#commands) |
| CI-style parallel browser runs | [Selection and sharding](#selection-and-sharding) |
| Adding coverage for a new feature | [Writing tests](#writing-tests) |
| A failing check | [When a check fails](#when-a-check-fails) |

---

## English

### Prerequisites

| Requirement | Used by | Note |
|---|---|---|
| Node.js 22 | all layers | The version used in CI. |
| Chrome or Chromium | E2E, compatibility, offline-real | Set `CHROME_BIN` when not auto-detected. |
| FFmpeg and FFprobe | compatibility, independent audio | Optional; skipped explicitly when absent. |
| OpenSSL (`openssl cms`) | compatibility, signed PDF case | Required only for that case. |
| `xmllint`, LibreOffice | independent Office validation | Optional; a skip is never a pass. |

### Test layers

| Layer | Command | Scope |
|---|---|---|
| Unit | `npm test` | Detectors, change plans, integrity, adapters, i18n, offline manifest, README parity. |
| Fast gate | `npm run test:fast` | Unit, lint, CSS, policy, and asset checks without a browser. |
| E2E, single suite | `npm run test:e2e` | Open, edit, save smoke flow. |
| E2E, all suites | `npm run test:e2e:all` | Every suite listed in `tests/e2e/run-all.mjs`, one shared Chrome process. |
| Compatibility | `npm run test:compat` | Real files with real Workers and WASM; jobs are listed in `tests/compat/jobs.mjs`. |
| Independent | `npm run test:audit`, `npm run test:independent:office`, `npm run test:independent:audio` | Out-of-browser verification; artifacts go to an OS temporary directory. |
| Static | `npm run lint`, `npm run check:css`, `npm run check:policies`, `npm run check:assets` | Bundles, policy pages, vendored assets, and README parity. |

Detailed harness notes live in
[tests/compat/README.md](../tests/compat/README.md),
[tests/fixtures/README.md](../tests/fixtures/README.md), and
[tests/independent/README.md](../tests/independent/README.md).

### Commands

```bash
npm ci                    # install pinned dev dependencies
npm run test:fast         # fastest local gate, no browser
npm test                  # unit tests
npm run lint              # ESLint
npm run check:css         # CSS bundle matches its sources
npm run check:policies    # policy HTML matches its Markdown sources
npm run check:assets      # vendored asset size and SHA-256
npm run test:e2e:all      # all E2E suites, requires Chrome
npm run test:cut          # audio/video range-cut suite only
npm run test:history      # change-history / rollback suite only
npm run test:timed-text   # lyrics/subtitle editor suite only
npm run test:compat       # real-file harness
npm run fixtures:generate # regenerate optional fixtures
```

HEIC, RAW still images, and RAW video are covered by the unit suites
`tests/unit/image-metadata-fields.test.js`, `tests/unit/detector.test.js`, and
`tests/unit/raw-video.test.js`. There are no dedicated npm scripts for those
formats. If a fixture is unavailable (for example a licensed BRAW/R3D sample),
report the case explicitly as `SKIP:` — a skip is **not** a pass.

### Selection and sharding

CI splits the E2E suites across several runners. Recognized variables:

| Variable | Example | Purpose |
|---|---|---|
| `MEINSERT_E2E_SHARD` | `1/4` | Run one quarter of the suites, numbered from one. |
| `MEINSERT_SUITES` | `smoke,security,office` | Run only the named suites. |
| `CHROME_BIN` | `/usr/bin/google-chrome` | Explicit browser executable path. |
| `COMPAT_CONCURRENCY` | `2` | Parallel compatibility jobs, from one to eight. |

```bash
MEINSERT_E2E_SHARD=1/4 npm run test:e2e:all
node tests/e2e/run-all.mjs --suites=smoke,security
npm run test:compat -- --concurrency 1
npm run test:compat -- --format tiff,mp4
```

Valid suite names come from `allSuites` in `tests/e2e/run-all.mjs`; valid
compatibility job ids come from `tests/compat/jobs.mjs`.

### Writing tests

1. Add unit tests under `tests/unit/` with `node:test`. Exercise the real flow:
   read, plan, write, re-read, and verify — not just one helper.
2. For an E2E suite, add a file under `tests/e2e/` and register it in
   `allSuites` in `tests/e2e/run-all.mjs`. Keep every request same-origin.
3. For a new format, follow
   [Adding a new format](../CONTRIBUTING.md#adding-a-new-format): fixture, unit
   test, compatibility case, and an update to
   [LIMITATIONS.md](LIMITATIONS.md).
4. Every new UI string must exist in both `id.js` and `en.js`, and be looked up
   with `t('…')`.
5. New offline assets must be added to `sw.js`; keep the version markers in
   sync as described in [RELEASING.md](RELEASING.md#version-sync).

> [!IMPORTANT]
> Report a `SKIP:` result as a skip, never as a pass. Do not add a
> known-failure allowlist that hides a regression.

### When a check fails

- A static check fails: run the matching generator (`build:css`,
  `build:policies`, or `vendor`), then repeat the `check:*` command.
- One E2E suite fails: rerun only that suite with `MEINSERT_SUITES`.
- One compatibility job fails: narrow it with `--format <id>` and read the
  per-job log.
- A tool is missing: see [Troubleshooting](TROUBLESHOOTING.md) and the
  prerequisites table above.

### Related

[Documentation map](README.md) · [Contributing](../CONTRIBUTING.md) ·
[Release checklist](RELEASING.md)

---

## Bahasa Indonesia

### Prasyarat

| Kebutuhan | Dipakai oleh | Catatan |
|---|---|---|
| Node.js 22 | semua lapisan | Versi yang dipakai CI. |
| Chrome atau Chromium | E2E, kompatibilitas, offline-real | Atur `CHROME_BIN` bila tidak terdeteksi. |
| FFmpeg dan FFprobe | kompatibilitas, audio independen | Opsional; dilewati secara eksplisit bila absen. |
| OpenSSL (`openssl cms`) | kompatibilitas, kasus PDF bertanda tangan | Hanya diperlukan untuk kasus itu. |
| `xmllint`, LibreOffice | validasi Office independen | Opsional; skip bukan berarti lulus. |

### Lapisan tes

| Lapisan | Perintah | Lingkup |
|---|---|---|
| Unit | `npm test` | Deteksi, change plan, integritas, adapter, i18n, manifest offline, parity README. |
| Gate cepat | `npm run test:fast` | Unit, lint, CSS, kebijakan, dan aset tanpa browser. |
| E2E satu suite | `npm run test:e2e` | Alur open, edit, save. |
| E2E semua | `npm run test:e2e:all` | Semua suite dalam `tests/e2e/run-all.mjs`, satu proses Chrome bersama. |
| Kompatibilitas | `npm run test:compat` | File nyata dengan Worker dan WASM sungguhan; job ada di `tests/compat/jobs.mjs`. |
| Independen | `npm run test:audit`, `npm run test:independent:office`, `npm run test:independent:audio` | Verifikasi di luar browser; artefak di direktori sementara OS. |
| Statis | `npm run lint`, `npm run check:css`, `npm run check:policies`, `npm run check:assets` | Bundel, halaman kebijakan, aset vendor, parity README. |

Catatan tiap harness ada di
[tests/compat/README.md](../tests/compat/README.md),
[tests/fixtures/README.md](../tests/fixtures/README.md), dan
[tests/independent/README.md](../tests/independent/README.md).

### Perintah

```bash
npm ci                    # pasang dependensi pengembangan yang di-pin
npm run test:fast         # gate lokal tercepat, tanpa browser
npm test                  # unit test
npm run lint              # ESLint
npm run check:css         # bundel CSS sesuai sumber
npm run check:policies    # HTML kebijakan sesuai Markdown
npm run check:assets      # ukuran dan SHA-256 aset vendor
npm run test:e2e:all      # semua suite E2E, butuh Chrome
npm run test:cut          # hanya suite potong audio/video
npm run test:history      # hanya suite riwayat perubahan / rollback
npm run test:timed-text   # hanya suite editor lirik/subtitle
npm run test:compat       # harness file nyata
npm run fixtures:generate # regenerasi fixture opsional
```

HEIC, gambar RAW, dan RAW video diuji lewat suite unit
`tests/unit/image-metadata-fields.test.js`, `tests/unit/detector.test.js`, dan
`tests/unit/raw-video.test.js`. Tidak ada skrip npm khusus untuk format tersebut.
Bila fixture tidak tersedia (misalnya sampel BRAW/R3D berlisensi), laporkan kasus
tersebut secara eksplisit sebagai `SKIP:` — skip **bukan** lulus.

### Seleksi dan sharding

CI membagi suite E2E ke beberapa runner. Variabel yang dikenal:

| Variabel | Contoh | Fungsi |
|---|---|---|
| `MEINSERT_E2E_SHARD` | `1/4` | Jalankan bagian ke-N dari empat. |
| `MEINSERT_SUITES` | `smoke,security,office` | Jalankan hanya suite yang disebut. |
| `CHROME_BIN` | `/usr/bin/google-chrome` | Path eksplisit ke browser. |
| `COMPAT_CONCURRENCY` | `2` | Job kompatibilitas paralel, rentang satu sampai delapan. |

```bash
MEINSERT_E2E_SHARD=1/4 npm run test:e2e:all
node tests/e2e/run-all.mjs --suites=smoke,security
npm run test:compat -- --concurrency 1
npm run test:compat -- --format tiff,mp4
```

Nama suite yang valid berasal dari `allSuites` di `tests/e2e/run-all.mjs`;
id job kompatibilitas berasal dari `tests/compat/jobs.mjs`.

### Menulis tes

1. Tambahkan unit test di `tests/unit/` dengan `node:test`. Uji alur nyata:
   baca, rencanakan, tulis, baca ulang, dan verifikasi — bukan hanya satu helper.
2. Untuk suite E2E, tambahkan file di `tests/e2e/` dan daftarkan di `allSuites`
   pada `tests/e2e/run-all.mjs`. Pastikan semua permintaan tetap same-origin.
3. Untuk format baru, ikuti
   [Adding a new format](../CONTRIBUTING.md#adding-a-new-format): fixture, unit
   test, kasus kompatibilitas, dan pembaruan
   [LIMITATIONS.md](LIMITATIONS.md).
4. Setiap string UI baru harus ada di `id.js` dan `en.js`, lalu diakses dengan
   `t('…')`.
5. Aset offline baru wajib ditambahkan ke `sw.js`; jaga sinkronisasi penanda
   versi seperti di [RELEASING.md](RELEASING.md#version-sync).

> [!IMPORTANT]
> Laporkan `SKIP:` sebagai skip, jangan pernah sebagai lulus. Jangan menambah
> daftar pengecualian kegagalan yang menyembunyikan regresi.

### Saat pemeriksaan gagal

- Pemeriksaan statis gagal: jalankan generator yang sesuai (`build:css`,
  `build:policies`, atau `vendor`), lalu ulangi perintah `check:*`.
- Satu suite E2E gagal: jalankan hanya suite itu dengan `MEINSERT_SUITES`.
- Satu job kompatibilitas gagal: persempit dengan `--format <id>` dan baca log
  per-job.
- Alat tidak tersedia: lihat [Pemecahan masalah](TROUBLESHOOTING.md) dan tabel
  prasyarat di atas.

### Terkait

[Peta dokumentasi](README.md) · [Kontribusi](../CONTRIBUTING.md) ·
[Checklist rilis](RELEASING.md)
