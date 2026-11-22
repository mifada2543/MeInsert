# MeInsert — Acceptable Use Policy

[Indonesia](TERMS.md) · **English** · [Privacy](PRIVACY-en.md) · [README](README-en.md)

Last updated: **15 November 2026**.

## 1. Scope

MeInsert is a local metadata editor for images, audio, video, and PDF files.
This policy explains acceptable use, misuse restrictions, and application
limitations. It is not legal advice.

Rights to use, copy, modify, and distribute the code are governed by
[MeInsert Source-Available License v1.0](LICENSE) and the respective component licenses. This document
does not add software-license restrictions, reduce license-granted rights, or
amend license terms. The misuse provisions below state project policy and users'
legal responsibilities.

## 2. Acceptable use

Use MeInsert only on files you own or are authorized to edit, for example to
correct titles, organize collections, add accurate attribution, or remove
personal information from copies you are entitled to modify.

Lawful correction or privacy protection is not inherently forgery. Ensure edits
do not mislead others, infringe their rights, or interfere with evidence-retention
obligations.

## 3. Prohibited forgery and misuse

**Forgery for deception, impersonation, or unlawful purposes is prohibited.**
Do not use MeInsert to:

- Falsify authorship, ownership, sources, dates, locations, signatures, or file
  history to deceive others.
- Forge documents, evidence, credentials, copyright attribution, or authenticity
  claims; falsely present edited files as original or certified.
- Unlawfully remove or alter rights-management information, plagiarize, defraud,
  violate privacy, or facilitate criminal conduct.
- Destroy or conceal evidence that must be preserved.

**Forgery or misuse established to violate the law may result in criminal,
civil, and/or administrative penalties under applicable law.** The type and
extent of punishment depend on jurisdiction, facts, and lawful proceedings and
decisions by competent authorities; MeInsert does not determine or automatically
impose penalties. The application is not a monitoring, investigation, automatic
reporting, or law-enforcement system.

## 4. Workflow and responsibilities

1. Open the application; your browser retrieves application files and required engines.
2. Select a local file. JavaScript, Web Workers, and/or WebAssembly read it in
   your browser. **The official MeInsert application does not send or upload
   your file contents or the metadata you edit to a server.**
3. Inspect the metadata and edit only what you are authorized to change.
4. Review the change plan and warnings before approving a write.
5. The application creates local output, re-reads it, and reports integrity findings.
6. Download a copy or batch ZIP/reports. Retain your originals and check the
   output before relying on it or sharing it.

See the [Privacy Policy](PRIVACY-en.md) for the distinction between local file
contents, browser preferences, application caches, and hosting access logs.

## 5. Capabilities and risks

- MeInsert does not certify identity, ownership, authenticity, or legality.
  Editable metadata is not, by itself, evidence of authenticity.
- Rewriting metadata may remove unsupported tags or change container structure,
  timestamps, or duration. Integrity findings do not guarantee all content is
  valid. See the [limitations](README-en.md#limitations).
- **Editing a digitally signed PDF can invalidate its signature.** Preserving
  signature bytes does not preserve cryptographic validity. Work on copies,
  keep originals, and verify signatures independently.
- Format, cover, size, memory, and browser-feature support are limited.
  FLAC-in-Ogg and Speex are unsupported; some players do not display Ogg/Opus covers.
- Closing a tab, browser failures, or memory exhaustion may lose work not yet
  downloaded. There is no server storage or account-recovery service.

## 6. Warranty, liability, and updates

The software is provided as-is, subject to the warranty disclaimer and liability
provisions of LICENSE to the extent allowed by law. This policy does not exclude
non-waivable rights or responsibilities. You are responsible for authorization,
accurate edits, backups, and use of the results.

This policy may change; consult its date and repository version. Forks, browser
extensions, or modified deployments may behave differently and have different
policies from the official application.

## 7. Contact

Project: https://github.com/mifada2543/meinsert  
Email: mifada2543@gmail.com

Do not submit sensitive files, original evidence, or personal metadata through
issues/email. Use synthetic examples and redacted details.
