# MeInsert — Privacy Policy

[Indonesia](PRIVACY.md) · **English** · [Acceptable Use](TERMS-en.md) · [README](README-en.md)

Last updated: **15 November 2026**.

## 1. Core promise: files stay on your device

**The official MeInsert application never sends or uploads selected file
contents, metadata read or edited, cover art, or processing outputs to a server.
All such processing takes place locally in your browser.**

MeInsert has no file-upload endpoint, user accounts, or server-side file storage.
It includes no analytics, telemetry, or profiling. This policy covers official
code, not forks, modified deployments, browser extensions, malware, operating
systems, or other applications.

This statement concerns **the files and metadata you process**; it does not mean
your browser never communicates with hosting infrastructure when opening the site.

## 2. Data-processing workflow

1. **Load the app:** the browser requests HTML, CSS, JavaScript, fonts, icons,
   and required engines from the site's origin. ExifTool WASM and some libraries
   are fetched when first needed and may be cached.
2. **Select files:** a file picker or drag-and-drop grants access to the files
   you choose. The application does not scan your entire disk.
3. **Read:** the browser and Web Workers/WASM read local bytes and display
   fields, raw tags, covers, and previews. No upload occurs.
4. **Edit and review:** changes stay in browser state/memory; the review dialog
   displays the plan and risks before writing.
5. **Write and verify:** new output is created locally and read again for
   comparison against the change plan. Batch processing follows the same model.
6. **Download:** the browser saves outputs or ZIP/reports to a location you
   choose. File-system APIs require browser permission when used. MeInsert does
   not automatically overwrite originals.

## 3. Network requests and hosting logs

To serve the site, hosting/CDN operators may receive request details such as IP
addresses, access times, asset URLs, user-agent strings, and browser headers.
Logging and retention depend on the hosting operator, not the local metadata
engine. Self-hosting may also generate Apache or other server access logs.

**These application-asset requests do not contain files or metadata you select
for editing.** Do not place sensitive information in site URLs. Following
external links, such as GitHub, opens services with their own privacy policies.
Issues/emails you voluntarily submit leave your device and are subject to the
receiving service's policies.

## 4. Browser storage and local copies

- `localStorage` stores preferences including theme and language
  (`meinsert-theme`, `meinsert-language`), not metadata-file contents.
- `localStorage` also stores a single timestamp under the `meinsert.policyAck`
  key to remember that the policy notice was acknowledged, valid for 30 days.
  It is **only a local acknowledgment timestamp** — not analytics, not
  tracking, not uploaded, and it is removed when you clear browser storage.
- Service workers/Cache Storage retain **application assets**, fonts, libraries,
  and WASM for offline use, not an upload archive or your file collection.
- Files, previews/object URLs, edits, and outputs may remain in memory during
  the session. Resource cleanup is attempted but does not guarantee forensic
  erasure from RAM, swap, system caches, or browser session recovery.
- Downloads and JSON/CSV reports may contain filenames and your metadata.
  They remain until you delete them and may be included in device cloud sync
  or backups configured outside MeInsert.

Optional engines for audio, images/video, PDF, and Office are downloaded only
when you request them from **Settings → Storage & Offline**. They are stored in
your device's browser cache, are local only, are not analytics, and are never
uploaded to a server. You can clear them at any time from Settings. When
Save-Data is enabled, MeInsert forces frugal mode and does not download
optional engines.

Close the session and clear site data in browser settings to remove application
preferences/caches. Delete downloaded files/reports separately. There is no
MeInsert server copy of your files for which deletion needs to be requested.

## 5. Privacy and security limits

Offline operation does not eliminate all threats. Use official sources, an
updated browser, and trusted devices/extensions. Removing one field does not
necessarily remove all personal information: it may remain in other tags,
covers, visual/audio content, or reports. Independently inspect output before
sharing it. MeInsert does not guarantee anonymity, complete sanitization, or
digital-signature validity.

## 6. Prohibited forgery and legal consequences

**Local privacy is not permission to commit forgery. Falsifying identities,
attribution, documents, evidence, origins, or dates for deception or unlawful
purposes is prohibited.** Lawful corrections and removal of personal information
are not automatically forgery.

**Forgery or misuse established to violate the law may result in criminal,
civil, and/or administrative penalties under applicable law.** Punishment is
determined by the facts, jurisdiction, and lawful proceedings/decisions of
competent authorities, not automatically by MeInsert. The application does not
upload files to detect forgery or provide automatic user monitoring/reporting.
See the [Acceptable Use Policy](TERMS-en.md).

## 7. Contact and updates

Project: https://github.com/mifada2543/meinsert  
Email: mifada2543@gmail.com

Do not attach sensitive files or personal metadata when reporting issues. This
policy may be updated to reflect official code behavior; the revision date is
shown above. Code rights remain governed by [LICENSE](LICENSE).
