## Summary

<!-- What changed and why. Keep one clear subtask per PR. -->

## Type of change

- [ ] Bug fix
- [ ] New feature or format support
- [ ] Documentation only
- [ ] Refactor, tooling, or CI

## Checklist

**Project invariants** (see [CONTRIBUTING.md](../CONTRIBUTING.md#hard-rules))

- [ ] No outgoing network for user files — no uploads, analytics, or requests to a non-same-origin URL.
- [ ] The original file is never overwritten: review → write → re-read/verify → download a new file.
- [ ] New UI strings exist in both `assets/js/i18n/id.js` and `assets/js/i18n/en.js`.

**Build outputs and offline**

- [ ] CSS sources edited under `assets/css/` and `assets/css/app.bundle.css` rebuilt with `npm run build:css`.
- [ ] If policy Markdown changed, `npm run build:policies` was run and the generated HTML is committed.
- [ ] New offline assets added to `SHELL_URLS` in `sw.js`; `CACHE_VERSION` (`sw.js`) and `CURRENT_VERSION` (`assets/js/core/build.js`) bumped together to the same value.

**Quality**

- [ ] Tests run locally: `npm run lint && npm test && npm run check:css && npm run check:policies`.
- [ ] New or changed behavior is covered by a unit test and, where relevant, `npm run test:compat`.
- [ ] Documentation updated (`README.md` / `README-en.md`, `docs/LIMITATIONS.md`) where applicable.
