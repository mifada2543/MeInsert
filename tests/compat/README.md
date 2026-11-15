# Real-file compatibility harness

```sh
npm ci
CHROME_BIN=/usr/bin/google-chrome npm run test:compat
```

Requires Chrome/Chromium and OpenSSL (`openssl cms`) on PATH. Node 22 is used in
CI. No server-side processing, downloads, uploads, or remote dependencies are
used by the app: the harness serves static local files on a random loopback
port, allows only same-origin GET requests, and fails on other browser requests
or uncaught page errors. Fixture generation is a separate optional developer
command: `npm run fixtures:generate`.

## Architecture and assertions

`run.mjs` uses playwright-core and real headless Chrome on `single.html`.
`browser.mjs` imports production detection, registry, snapshots, change-plan,
integrity and `MetadataClient`. Every adapter read/write/re-read goes through
the production Web Worker RPC and actual bundled engines, including ExifTool
WASM. No engine or worker mocks. Service workers are blocked to prevent stale
cached code; the separate existing smoke test covers offline/service-worker UI.

The fixture matrix covers JPEG, PNG, WebP, TIFF, MP3, FLAC, Opus, Vorbis, MP4,
MKV, WebM, MOV, M4A, ordinary PDF and genuinely self-signed PDF, plus a mislabeled
PNG and two negative Ogg codecs. Aliases such as `.jpeg`, `.m4v`, and `.oga` are
not separate media fixtures. This is a bounded fixture matrix, not proof for all
files/codecs, chapters, foreign tags, or field combinations.

For each positive fixture:

1. Detect content and perform a real worker read.
2. Supply baseline values plus one changed title to `buildChangePlan`; assert
   the resulting payload contains **only title**, with exactly one operation.
3. Write, independently re-read the resulting Blob through the same worker,
   assert title persisted, and re-detect output container/subtype/extension.
4. Run the unmodified production integrity engine against the complete original
   and re-read snapshots. Any `failed` or unverified result fails the fixture.
   Warnings are printed, not disguised as an entirely clean inventory.
5. For Opus/Vorbis, compare original and output embedded cover bytes exactly,
   even if the separate strict integrity check fails.
6. For signed PDF, independently verify the **original** CMS in Node/OpenSSL,
   compare signature Contents bytes after browser writing, and check original
   read warning and pre-write plan risk. Also report whether the signed ranges
   changed. Signature validity preservation is NOT asserted: current rewriting
   changes signed bytes and invalidates the signature (see fixture README).

Both read and write must reject FLAC-in-Ogg and Speex with useful errors. Real
GIF/BMP covers are written and independently re-read byte-exactly for MP3,
FLAC, Opus, Vorbis and MKV. MP4's production cover policy is checked, then the
real UI is driven to verify rejection of each file and a still-disabled save
button. The MP4 adapter itself is not claimed to enforce the picker policy.

The UI also opens the mislabeled PNG, edits title, reviews, saves, and downloads;
the output label and downloaded name must be `.png`. This checks the **default**
content-following path. The app still offers an explicit “keep original
extension” override in the review dialog; the harness does not assert that
such an override is impossible or that mismatched extensions are rejected.

Per-case tables and findings go to stdout. Any failed invariant exits nonzero;
there is no expected-failure allowlist, silent skip, filter, snapshot mutation,
or weakened integrity policy. Workers/browser/server are closed after testing.

## Current findings (2026-11-15)

The new strict harness is intentionally **not green** on the current production
code. Title read/write/re-read succeeds for every positive fixture. The following
eight cases fail the production integrity engine:

| Fixture | Finding |
| --- | --- |
| `pattern.tif` | IFD0:StripOffsets changes from 8 to 3166 |
| `tone.flac` | Vorbis vendor changes from ffmpeg/Lavf to Mediabunny |
| `tone.opus`, `tone.ogg` | Same vendor change; METADATA_BLOCK_PICTURE's dimensions/depth become zero, triggering custom-tag change (actual PNG cover bytes are preserved) |
| `clip.mp4`, `tone.m4a` | QuickTime:MediaDataOffset changes when metadata is inserted |
| `clip.mov` | Same offset change, plus requested title changes UserData:Title, which the verifier classifies as unexpected |
| `clip.mkv` | Re-read duration changes from 0.3s to 0.2s |

Offset changes are plausibly necessary container bookkeeping, and vendor/title
alias findings may need integrity-policy decisions rather than adapter fixes.
They remain failures here because the harness must use the production policy
unchanged. The MKV duration result needs investigation; this harness alone does
not prove encoded frame loss. No production source was modified for this task.

The original signed PDF verifies cryptographically; its output retains Contents
but not signed-range bytes. If the requirement is to preserve signature validity
or original signed-range bytes, that is a separate unmet production requirement,
not something these tests can claim to fix.

## Wiring

`package.json`: `test:compat` and `fixtures:generate`; no new dependencies.
`.github/workflows/ci.yml`: separate `compat` job with setup-node@v4, Node 22,
npm cache, `npm ci`, and Chrome. Existing unit/e2e jobs are unchanged. Because
real failures are not suppressed, the compat CI job currently fails until the
production issues/policy decisions above are resolved.

Last verification on 2026-11-15:

- `npm test`: 63/63 pass (existing tests unchanged).
- `npm run lint`: exit 0, no ESLint diagnostics.
- `CHROME_BIN=/usr/bin/google-chrome npm run test:compat`: 25/33 pass,
  exit 1 for the eight strict integrity failures above; all positive fixtures'
  title read/write/re-read steps pass, and all rejection/cover/UI cases pass.
- `CHROME_BIN=/usr/bin/google-chrome npm run test:e2e`: exit 0, including offline
  reload and mobile layout checks.
- `pdfsig tests/fixtures/signed.pdf`: signature valid, entire document signed;
  expected untrusted self-signed certificate.
