<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Security Policy / Kebijakan Keamanan

MeInsert is a **fully client-side** metadata editor. There is no backend, no
upload endpoint, and no account. Files you open are read, edited, verified, and
downloaded entirely inside your browser.

MeInsert adalah editor metadata **100% sisi klien**. Tidak ada backend, endpoint
upload, atau akun. Berkas yang Anda buka dibaca, diedit, diverifikasi, dan
diunduh seluruhnya di dalam browser Anda.

## Supported Versions / Versi yang Didukung

| Version | Supported |
|---|---|
| Latest release (`v1.2.x` and newer) | ✅ |
| `main` branch (development) | ✅ |
| Older releases | ❌ — please update to the latest release first |

Security fixes land on `main` and are included in the next release.

## Reporting a Vulnerability / Melaporkan Kerentanan

**Please report privately. Do not open a public issue for a security bug.**

Use GitHub's private vulnerability reporting:

**https://github.com/mifada2543/meinsert/security/advisories/new**

The advisory form keeps the report visible only to the maintainer until a fix
is published. Do not invent or use an email address; the advisory form is the
only supported channel.

## What to Include / Yang Perlu Disertakan

- A clear description of the issue and its impact.
- Affected version or commit (and the browser/OS where it reproduces).
- Step-by-step reproduction, including any fixture or sample file needed.
- Whether the issue can be triggered without user interaction.
- Any suggested mitigation or fix, if you have one.

Please do **not** attach real personal files. Use a small synthetic fixture
(`tests/fixtures/` contains suitable samples).

## Response Expectations / Ekspektasi Respons

- **Acknowledgement:** best effort within 7 days.
- **Status updates:** at least once every 14 days while the report is being investigated.
- **Fix and disclosure:** a fix is prepared on `main`, released, and then the
  advisory is published with credit to the reporter (unless you prefer to stay anonymous).
- Reports that are out of scope, duplicates, or not security issues may be closed with an explanation.

## Scope / Cakupan

In scope: the static application in this repository — HTML pages, ES modules,
Web Workers, bundled WASM/vendor code, service worker, PWA manifest, and the
build/test scripts — plus any issue that would let a file's contents leave the
device or let one origin affect another.

Out of scope: the hosting provider's own infrastructure, DNS, third-party
library vulnerabilities that are already fixed in the bundled version, and
social engineering. The server that serves these static files **never receives
user files** — there is no code path that uploads file contents, edited
metadata, cover art, or processing results. Hosting access logs generated when
loading the site are a separate matter and are described in
[PRIVACY.md](PRIVACY.md).

The Content-Security-Policy meta tag on every page enforces
`connect-src 'self'`, so the application itself cannot make requests to any
other origin. See [docs/security.md](docs/security.md) for how to verify this.
