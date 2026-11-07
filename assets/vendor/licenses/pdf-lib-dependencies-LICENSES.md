# pdf-lib — Transitive Dependencies (embedded in `pdf-lib.esm.js`)

`pdf-lib v1.17.1` (MIT, © 2019 Andrew Dillon) is distributed as a single
minified ESM bundle. Per its `package.json`, the bundle embeds the
following runtime dependencies, each under its own license. Full texts
are maintained upstream; this file records the SPDX identifiers and
upstream URLs so that downstream recipients can locate the complete
license terms.

| Dependency | License (SPDX) | Upstream |
|---|---|---|
| `pako` v1.x | MIT AND Zlib | https://github.com/nodeca/pako |
| `@pdf-lib/standard-fonts` | MIT | https://github.com/Hopding/pdf-lib (packages/standard-fonts) |
| `@pdf-lib/upng` | MIT | https://github.com/Hopding/pdf-lib |
| `tslib` v1.x | 0BSD | https://github.com/Microsoft/TypeScript |

Notes:

- `pako`'s "MIT AND Zlib" means both texts apply; retain the pako
  copyright notice (© 2011-2019 Devongovett et al.) in any
  redistribution that includes its source.
- `tslib` (0BSD) is helper code emitted by TypeScript; it carries no
  obligation beyond the 0BSD notice.
- `package.json` in this directory is pdf-lib's package metadata
  (name, version, author, dependencies), kept for provenance. It is
  not a license; the operative license is `pdf-lib-LICENSE.md`.

All of the above were verified via `npm view <package> license`
during the MeInsert license audit (typescript `0BSD`, others MIT).
