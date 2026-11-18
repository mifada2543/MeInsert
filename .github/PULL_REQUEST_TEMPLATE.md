<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

## Summary

<!-- What changed and why. Keep one clear subtask per PR. -->

## Checklist

- [ ] No outgoing network for user files — no uploads, analytics, or requests to a non-same-origin URL.
- [ ] The original file is never overwritten: review → write → re-read/verify → download a new file.
- [ ] New UI strings exist in both `assets/js/i18n/id.js` and `assets/js/i18n/en.js`.
- [ ] CSS sources edited under `assets/css/` and `assets/css/app.bundle.css` rebuilt with `npm run build:css`.
- [ ] If policy Markdown changed, `npm run build:policies` was run and the generated HTML is committed.
- [ ] New offline assets added to `SHELL_URLS` in `sw.js`; `CACHE_VERSION` (`sw.js`) and `CURRENT_VERSION` (`assets/js/core/build.js`) bumped together to the same value.
- [ ] Tests run locally: `npm run lint && npm test && npm run check:css && npm run check:policies`.
- [ ] New/changed behavior covered by a unit test and, where relevant, `npm run test:compat`.
- [ ] Documentation updated (`README` / `README-en`, `docs/LIMITATIONS.md`) where applicable.

## Review note for the owner

> **v1.3 status:** the v1.3 changes are deliberately left **uncommitted in the
> working tree** pending owner review. Do not expect this set of changes as a
> commit or a prepared branch — the owner audits the working tree directly.
