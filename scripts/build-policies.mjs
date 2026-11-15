/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Deliberately small, escaped renderer for the project's own policy Markdown.
// No runtime Markdown fetching, external dependency, or untrusted HTML execution.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function href(value) {
  if (/^TERMS(?:-en)?\.md$/.test(value)) return './Terms.html';
  if (/^PRIVACY(?:-en)?\.md$/.test(value)) return './privacy.html';
  if (/^README(?:-en)?\.md$/.test(value)) return './';
  if (/^README(?:-en)?\.md#/.test(value)) return `./${value}`;
  if (/^(?:https?:\/\/|[A-Za-z0-9_.#/-]+$)/.test(value)) return value;
  throw new Error(`Unsupported policy link: ${value}`);
}
function inline(value) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|https?:\/\/[^\s]+/g;
  let out = '', cursor = 0;
  for (const match of value.matchAll(pattern)) {
    out += escape(value.slice(cursor, match.index));
    if (match[1]) out += `<a href="${escape(href(match[2]))}">${inline(match[1])}</a>`;
    else if (match[3]) out += `<strong>${inline(match[3])}</strong>`;
    else if (match[4]) out += `<code>${escape(match[4])}</code>`;
    else out += `<a href="${escape(href(match[0]))}">${escape(match[0])}</a>`;
    cursor = match.index + match[0].length;
  }
  return out + escape(value.slice(cursor));
}
async function article(file, locale, type) {
  const lines = (await readFile(resolve(root, file), 'utf8')).split('\n');
  const title = lines.shift().replace(/^# MeInsert — /, '');
  // Source-language navigation is provided by the shared live ID/EN control.
  const navigation = lines.findIndex((line) => line.includes('README]('));
  if (navigation >= 0) lines.splice(0, navigation + 1);
  const toc = [], parts = [];
  let index = 0, section = 0, list = null, sectionOpen = false;
  const closeList = () => { if (list) parts.push(`</${list}>`); list = null; };
  while (index < lines.length) {
    const line = lines[index++];
    if (!line.trim()) { closeList(); continue; }
    if (line.startsWith('## ')) {
      closeList();
      if (sectionOpen) parts.push('</section>');
      const title = line.slice(3), id = `${type}-${locale}-${++section}`;
      toc.push(`<li><a href="#${id}">${escape(title)}</a></li>`);
      parts.push(`<section class="policy-section" aria-labelledby="${id}"><h2 id="${id}">${escape(title)}</h2>`);
      sectionOpen = true;
      continue;
    }
    const item = /^(?:- |\d+\. )(.+)$/.exec(line);
    let content = item ? item[1] : line;
    while (index < lines.length && lines[index].trim() && !/^(?:## |\d+\. |- )/.test(lines[index])) content += ` ${lines[index++].trim()}`;
    if (item) {
      const kind = line.startsWith('- ') ? 'ul' : 'ol';
      if (list !== kind) { closeList(); parts.push(`<${kind}>`); list = kind; }
      parts.push(`<li>${inline(content)}</li>`);
    } else {
      closeList(); parts.push(`<p>${inline(content)}</p>`);
    }
  }
  closeList(); if (sectionOpen) parts.push('</section>');
  const tocTitle = locale === 'id' ? 'Di halaman ini' : 'On this page';
  return `<article class="policy-document" data-policy-language="${locale}" lang="${locale}"${locale === 'en' ? ' hidden' : ''}>
    <header class="policy-heading"><h1>${escape(title)}</h1></header>
    <div class="policy-layout">
      <nav class="policy-toc" aria-label="${tocTitle}"><h2>${tocTitle}</h2><ol>${toc.join('')}</ol></nav>
      <div class="policy-prose">${parts.join('\n')}</div>
    </div>
  </article>`;
}
export async function buildPolicies({ check = false } = {}) {
  const home = await readFile(resolve(root, 'index.html'), 'utf8');
  const header = home.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
  const footer = home.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) throw new Error('Shared header/footer unavailable');
  for (const [type, path, source, title] of [
    ['privacy', 'privacy.html', 'PRIVACY', 'Kebijakan Privasi'],
    ['terms', 'Terms.html', 'TERMS', 'Kebijakan Penggunaan'],
  ]) {
    const html = `<!doctype html>
<!-- MeInsert — Edit metadata file tanpa upload, 100% di browser. -->
<!-- Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert -->
<!-- reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 -->
<!-- Generated from ${source}.md / ${source}-en.md; run npm run build:policies. -->
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="${title} MeInsert — pemrosesan metadata lokal, batas penggunaan, dan tanggung jawab pengguna.">
  <title>MeInsert | ${title}</title>
  <link rel="canonical" href="https://meinsert.my.id/${path}">
  <link rel="manifest" href="manifest.json">
  <link rel="icon" type="image/png" sizes="64x64" href="assets/img/favicon-64.png">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  <script src="assets/js/theme-init.js"></script>
  <link rel="preload" href="assets/fonts/ibm-plex-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="assets/css/app.bundle.css">
</head>
<body data-page="${type}">
  <a class="skip-link" href="#main" data-i18n="ui.skipToContent">Lewati ke konten</a>
  ${header}
  <main class="shell policy-main" id="main">
    <div class="policy-intro"><a class="text-button" href="./" data-i18n="policy.backHome">Kembali ke beranda</a><p data-i18n="policy.aboutYourFiles">Tentang berkas Anda dan penggunaan MeInsert</p></div>
    ${await article(`${source}.md`, 'id', type)}
    ${await article(`${source}-en.md`, 'en', type)}
  </main>
  ${footer}
  <div class="toast-region" id="toastRegion" role="status" aria-live="polite" aria-atomic="false"></div>
  <script type="module" src="assets/js/home.js"></script>
</body>
</html>
`;
    if (check) {
      if (await readFile(resolve(root, path), 'utf8').catch(() => '') !== html) throw new Error(`${path} is stale: run npm run build:policies`);
    } else await writeFile(resolve(root, path), html);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPolicies({ check: process.argv.includes('--check') });
  console.log(process.argv.includes('--check') ? 'Policy HTML is synchronized.' : 'Built privacy.html and Terms.html.');
}
