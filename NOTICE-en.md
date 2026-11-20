MeInsert — NOTICE
==================

Copyright (C) 2026 mifada2543

MeInsert is a 100% client-side metadata editor for images, PDF, audio, and video.
All processing happens in your browser (WebAssembly + Web Workers). Files are never
uploaded, there is no backend, and no account is required. The application works
offline after the first visit, because a service worker caches the app shell.

Unless a file or component states otherwise, the source code in this repository is
licensed under the GNU Affero General Public License, version 3 or later
(AGPL-3.0-or-later). A
copy of the license is available in the LICENSE file.

This NOTICE file is informational only. It does not modify, replace, or add to the
terms of any applicable license. When redistributing MeInsert, preserve this file,
the LICENSE file, and all other copyright and license notices included with the
corresponding work.

THIRD-PARTY SOFTWARE AND TECHNOLOGIES
--------------------------------------

MeInsert bundles the following independent software in `assets/vendor/` and
`assets/fonts/`:

* ExifTool 13.60 — by Phil Harvey — https://exiftool.org/
  (Perl Artistic License or GPL; runs inside the WebAssembly build)
* @colorhythm/exiftool-wasm v1.0.5 — https://github.com/6over3/exiftool (Apache-2.0)
* zeroperl — https://github.com/6over3/zeroperl (MIT — Perl-in-WebAssembly runtime)
* Mediabunny v1.65.0 — https://github.com/Vanilagy/mediabunny (MPL-2.0)
* pdf-lib v1.17.1 — https://github.com/Hopding/pdf-lib (MIT)
* fflate v0.8.3 — https://github.com/101arrowz/fflate (MIT)
* browser-id3-writer v6.4.0 — https://github.com/egoroof/browser-id3-writer (MIT)
* IBM Plex fonts (Sans, Sans Condensed, Mono) — https://github.com/IBM/plex
  (SIL Open Font License 1.1)
* MEeL — LRC editor & timed-text helpers (adapted source) — © 2026 Mifada
  (mifada2543) — https://github.com/mifada2543/MEeL-HUB (AGPL-3.0-or-later)

**`assets/THIRD_PARTY_LICENSES.md` is the authoritative attribution index**
for the bundle, and `assets/vendor/licenses/` holds the verbatim license texts.
If an entry there disagrees with a file in `assets/vendor/licenses/`, the license
file controls for that component.

The bundled pdf-lib additionally carries the following transitive dependencies:
`pako` (MIT AND Zlib), `@pdf-lib/standard-fonts` (MIT), `@pdf-lib/upng` (MIT),
and `tslib` (0BSD) — see `assets/vendor/licenses/pdf-lib-dependencies-LICENSES.md`.

Brand artwork in `assets/img/` is original work authored for this project; see
`assets/img/PROVENANCE.md`.

These projects are separate works and are governed by their own licenses and
notices. Their names and trademarks belong to their respective owners. The
presence of a technology in this list does not by itself mean that a copy of that
technology is redistributed with every MeInsert installation.

If you distribute a package that includes third-party files, bundled assets,
modified components, generated media, fonts, icons, or other works not authored by
the project author, you are responsible for including the applicable license
texts and attribution notices required by those works. Please review the license
and notice files shipped with each dependency before redistribution.

AGPLv3 NETWORK COPYLEFT AND MONETIZATION
----------------------------------------

MeInsert may be monetized (paid product, paid hosting, premium services). AGPLv3
is a network copyleft license, so the obligations are:

* You may charge for distribution, support, or services.
* When conveying covered software, provide Corresponding Source as required
  by the applicable provisions of AGPLv3.
* If you modify the Program and your version supports remote network
  interaction, AGPLv3 section 13 requires prominently offering all users
  interacting with it remotely an opportunity to receive the Corresponding
  Source of your version, at no charge, through a standard or customary means.
* Private modifications alone do not require public publication. These
  obligations apply to the covered work, not automatically to independent
  software used alongside it.
* Third-party components above remain under their own licenses; AGPLv3 does not
  change them.

In short: monetization is allowed; applicable source-sharing duties remain. The text of the
`LICENSE` file is binding; this paragraph is only a plain-language summary.

USER-PROVIDED CONTENT AND EXTERNAL SERVICES
-------------------------------------------

MeInsert reads and writes metadata tags (EXIF, XMP, IPTC, ID3, Vorbis Comment,
Matroska, PDF Info Dictionary) in files that stay on your own device. The tool
can process or display your media, but the project author does not grant
permission to redistribute copyrighted music, video, books, artwork, trademarks,
or other third-party content merely because MeInsert can process or display it.

You are responsible for the files you edit: do not delete or forge attribution
rights of the original author, and comply with applicable law, copyright,
terms of service, and privacy obligations. Tampering with a digital signature,
a content signature, or a rights-management tag may be illegal in your
jurisdiction. Editing a signed document can invalidate its signature. Do not
rely on metadata editing to preserve cryptographic signature validity; keep the
original signed file and verify signatures independently.

MeInsert performs no analytics, no telemetry, and no profiling. The application
requests no network resource other than the files it serves from its own origin
(the app shell, fonts, libraries, and the optional ExifTool WebAssembly module).

TRADEMARKS
----------

MeInsert and the MeInsert name and logo are used to identify this project. They
may not be used to imply endorsement of modified or redistributed versions
without permission. ExifTool, Mediabunny, pdf-lib, fflate, browser-id3-writer,
IBM Plex, and zeroperl are trademarks of their respective owners; they are
mentioned only to identify the origin of the bundled code, not as endorsement or
sponsorship.

CONTACT
-------

Project: https://github.com/mifada2543/meinsert
Live:    https://meinsert.my.id/
Author:  mifada2543
Email:   mifada2543@gmail.com
