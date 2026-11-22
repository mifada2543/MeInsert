<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->

# Documentation style guide

> How Markdown is written in this repository so every page looks and reads the
> same. Applies to all `*.md` files that MeInsert authors itself.

## Contents

- [Principles](#principles)
- [Page anatomy](#page-anatomy)
- [Formatting rules](#formatting-rules)
- [Bilingual pages](#bilingual-pages)
- [File-specific constraints](#file-specific-constraints)
- [Pre-commit checklist](#pre-commit-checklist)

## Principles

1. **Lead with the answer.** The first screen says what the page is, who it is
   for, and where to go next.
2. **One idea per section.** Short sections with descriptive headings beat long
   walls of text.
3. **Prefer structure over prose when readers scan.** Use tables for reference
   data, numbered lists for procedures, bullets for unordered facts.
4. **Be accurate before being impressive.** State limits plainly; never describe
   a limitation as a feature. Avoid hard-coded counts that go stale (test totals,
   suite counts) unless a script verifies them.
5. **Keep both languages equivalent.** Indonesian and English pages must say the
   same thing.

## Page anatomy

Every page follows this order:

1. The three provenance comment lines at the top of the file (where the file
   already has them — see the note below).
2. A single `#` title.
3. One lead sentence or a short blockquote summarizing the page.
4. A `## Contents` list when the page has more than four sections.
5. The body, using `##` sections and, only when needed, `###` and `####`.
6. Cross-links to related pages at the end.

> [!NOTE]
> The `reference build:` comment is a non-functional provenance marker. Keep it
> on files that already carry it; see
> [CONTRIBUTING.md](../CONTRIBUTING.md#the-reference-build-marker).

## Formatting rules

| Topic | Rule |
|---|---|
| Headings | One H1 per file; never skip a level; sentence case; no trailing punctuation. |
| Line length | Wrap prose near 80 columns. Tables and URLs are exempt. |
| Emphasis | **Bold** for UI labels and key warnings, *italics* for terms, `code` for identifiers, paths, commands, and values. |
| Code blocks | Always add a language tag (`bash`, `text`, `js`, `mermaid`). |
| Lists | `-` for bullets; `1.` for ordered steps. Keep items parallel in grammar. |
| Tables | Use for reference data with the same columns in every row. Right-align numeric columns. |
| Links | Relative paths for repository files; descriptive link text, never "click here". Verify anchors after renaming a heading. |
| Callouts | GitHub alert syntax: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`. Use sparingly, one per section at most. |
| Emoji | Not in headings, tables, or body text. The only exception is the ☰ and ✕ characters that name real UI controls. |
| Badges | One row, `flat-square` style, at most five. |
| Diagrams | Prefer Mermaid fenced blocks so they diff cleanly. |

## Bilingual pages

- **Whole-page pairs** (`README.md` / `README-en.md`, `TERMS.md` / `TERMS-en.md`,
  and so on): keep the two files structurally identical and cross-link them at
  the top.
- **Single-file bilingual pages** (`SECURITY.md`, `docs/security.md`,
  `docs/deployment.md`): put a language switch under the title, then one `##`
  section per language (`## English`, `## Bahasa Indonesia`) with identical
  `###` subsections. Do not interleave paragraphs of both languages.
- Translate meaning, not word order. Keep identifiers, commands, and file names
  untranslated.

## File-specific constraints

Some files are consumed by code or served raw, so they have extra rules.

| Files | Constraint | Enforced by |
|---|---|---|
| `README.md`, `README-en.md` | Same heading-level sequence; same set of `docs/*.md` links; version badge equals `package.json`; no wording that presents a shipped feature as upcoming. | `tests/unit/readme-parity.test.js` |
| `PRIVACY*.md`, `TERMS*.md` | Rendered by `scripts/build-policies.mjs`. Only a first-line `# MeInsert — …` title, a navigation line, `##` headings, paragraphs, `-` and `1.` lists, links, **bold**, and `code`. No tables, blockquotes, or HTML. Regenerate with `npm run build:policies`. | `npm run check:policies` |
| `NOTICE*.md`, `assets/THIRD_PARTY_LICENSES.md` | Linked from every page footer and served as plain text, so they must stay readable raw: no HTML and no alert syntax. | Manual review |
| `LICENSE`, `NOTICE*.md` | Binding and bilingual; the plain-language summary must not contradict the license text. The second watermark line must name the current license. | Manual review, `tests/unit/watermark.test.js` |
| `assets/vendor/licenses/*` | Verbatim upstream license texts. Never reformat. | Manual review |
| `CHANGELOG.md` | [Keep a Changelog](https://keepachangelog.com/) layout, newest first, Indonesian. | Manual review |

## Pre-commit checklist

- [ ] One H1, no skipped heading levels, and every `#anchor` link resolves.
- [ ] Relative links point to files that exist.
- [ ] Code blocks have language tags; commands were run at least once.
- [ ] Indonesian and English versions say the same thing.
- [ ] No stale counts, dates, or version numbers.
- [ ] `npm run test:fast` passes (it runs the README parity test and the policy
      sync check).
