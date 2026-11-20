# Independent verification harnesses

These scripts are **development-only** checks. They never run in the browser
and are not runtime dependencies of MeInsert.

| Command | What it checks | External tools |
|---|---|---|
| `npm run test:audit` | 24 audit cases: format roundtrip, namespace prefixes, padded/generic ZIP, ODF signature, integrity | none |
| `npm run test:independent:office` | Writes all 9 Office fixtures, parses every XML part, optionally validates with `xmllint` and opens every file in LibreOffice | `xmllint`, `soffice`/`libreoffice` (optional) |
| `npm run test:independent:audio` | Compares FFprobe stream info and FFmpeg decoded PCM hashes before/after Ogg metadata writes | `ffmpeg`, `ffprobe` (optional) |

Every script:

- resolves fixtures and modules relative to this repository, so it works from
  any current working directory (for example `npm --prefix /path/to/Meinsert run …`);
- writes artefacts only into an OS temporary directory (`os.tmpdir()` +
  `mkdtempSync()`) and removes it in a `finally` block;
- prints `SKIP: …` when an optional external tool is unavailable. A skipped
  check is never reported as a pass.

Macro/signature warnings from the Office adapter are expected informational
warnings; any other write warning is treated as a failure.
