/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.pdf': 'application/pdf', '.md': 'text/plain' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const path = normalize(join(root, pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!path.startsWith(root) || !existsSync(path)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8` });
  createReadStream(path).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = [process.env.CHROME_BIN, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-dev-shm-usage'] });
const errors = [];
const context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block', acceptDownloads: true });
context.on('page', (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.error('browser console:', message.text()); });
});
const page = await context.newPage();
const change = async (locale, target = page) => target.evaluate(async (value) => (await import('/assets/js/i18n/index.js')).setLanguage(value), locale);

try {
  for (const name of ['index.html', 'single.html', 'batch.html']) {
    await page.goto(`${base}/${name}`);
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.match(await page.title(), /without uploading/);
    assert.equal(await page.locator('[data-language-toggle]').innerText(), 'EN');
    assert.equal(await page.locator('[data-language-toggle]').getAttribute('aria-label'), 'Switch language to Bahasa Indonesia');
    assert.equal(await page.locator('[data-language-toggle]').count(), 1);
    const buttonSizes = await page.evaluate(() => {
      const language = document.querySelector('[data-language-toggle]').getBoundingClientRect();
      const theme = document.querySelector('#themeToggle').getBoundingClientRect();
      return [language.width, language.height, theme.width, theme.height];
    });
    assert.equal(buttonSizes[0], buttonSizes[2]);
    assert.equal(buttonSizes[1], buttonSizes[3]);
    assert.equal((await page.locator('[data-nav="single"]').innerText()).trim(), 'Single file');
    assert.equal(await page.locator('[data-policy="terms"]').getAttribute('href'), './TERMS-en.md');
    assert.equal(await page.locator('[data-policy="privacy"]').getAttribute('href'), './PRIVACY-en.md');
    assert.equal(await page.locator('[data-notice]').getAttribute('href'), './NOTICE-en.md');
    await page.locator('[data-language-toggle]').click();
    assert.equal(await page.locator('[data-language-toggle]').innerText(), 'ID');
    assert.equal(await page.locator('html').getAttribute('lang'), 'id');
    assert.equal(await page.locator('[data-policy="terms"]').getAttribute('href'), './TERMS.md');
    assert.equal(await page.locator('[data-policy="privacy"]').getAttribute('href'), './PRIVACY.md');
    assert.equal(await page.locator('[data-notice]').getAttribute('href'), './NOTICE.md');
    assert.equal(await page.locator('[data-policy="terms"]').innerText(), 'Kebijakan Penggunaan');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.lang === 'id');
    await change('en');
  }
  console.log('PASS: all three pages, accessible selector, titles, storage, navigation and policy links');

  await change('id');
  await page.goto(`${base}/single.html`);
  await page.locator('#fileInput').setInputFiles(join(root, 'tests/fixtures/document.pdf'));
  await page.locator('#field-title').waitFor({ timeout: 60000 });
  const value = 'Judul <img src=x onerror=alert(1)> — nilai asli';
  await page.locator('#field-title').fill(value);
  await page.locator('.custom-head button').click();
  await page.locator('.custom-key').fill('Judul');
  await page.locator('[name="custom-tag-value"]').fill('Nilai');
  await page.locator('#field-title').evaluate((input) => { window.i18nOriginalField = input; input.focus(); input.setSelectionRange(2, 8); });
  await change('en');
  assert.equal(await page.locator('#field-title').inputValue(), value);
  assert.equal(await page.locator('label[for="field-title"]').innerText(), 'Title');
  assert.equal(await page.locator('.custom-key').inputValue(), 'Judul');
  assert.equal(await page.locator('[name="custom-tag-value"]').inputValue(), 'Nilai');
  assert.equal(await page.locator('#field-title').evaluate((input) => input === window.i18nOriginalField && input.selectionStart === 2 && input.selectionEnd === 8), true);
  await page.locator('#saveBtn').click();
  await page.locator('#reviewTitle').waitFor();
  assert.equal(await page.locator('#reviewTitle').innerText(), 'Review changes');
  assert.ok((await page.locator('.review-after').allTextContents()).includes(value));
  assert.equal(await page.locator('.review-after img').count(), 0);
  const other = await context.newPage();
  await other.goto(`${base}/index.html`);
  await change('id', other);
  await page.waitForFunction(() => document.querySelector('#reviewTitle')?.textContent === 'Periksa sebelum menyimpan');
  await page.locator('.review-btn-cancel').click();
  assert.equal(await page.locator('#field-title').inputValue(), value);
  await page.locator('#newFileBtn').click();
  await page.locator('#confirmTitle').waitFor();
  await change('en', other);
  await page.waitForFunction(() => document.querySelector('#confirmTitle')?.textContent === 'Unsaved changes');
  await page.locator('.confirm-btn-cancel').click();
  assert.equal(await page.locator('#field-title').inputValue(), value);
  await other.close();
  console.log('PASS: editor node/caret/value preserved, review and confirm live-update through storage, user HTML stays plain text');

  await page.evaluate(async () => {
    const { createShell, setProgress, setStatus } = await import('/assets/js/editor/editor-shell.js');
    const shell = createShell(); setProgress(shell, 47, 'Membaca metadata…'); setStatus(shell, 'Membaca Judul…');
  });
  await change('id');
  assert.equal(await page.locator('#progressLabel').innerText(), 'Membaca metadata…');
  await change('en');
  assert.equal(await page.locator('#progressLabel').innerText(), 'Reading metadata…');
  assert.equal(await page.locator('#progressBar').evaluate((node) => node.style.width), '47%');
  assert.equal(await page.locator('#readStatus').innerText(), 'Reading Judul…');
  console.log('PASS: ongoing progress and status translate without resetting progress');

  await page.evaluate(async () => {
    const { openLightbox } = await import('/assets/js/ui/lightbox.js');
    openLightbox({ src: '/tests/fixtures/pattern.png', alt: 'Pratinjau Judul', caption: 'Judul' });
  });
  await page.locator('.lightbox-zoom-btn').last().waitFor();
  await page.locator('.lightbox-zoom-btn').nth(2).click();
  const transform = await page.locator('.lightbox-img').evaluate((image) => image.style.transform);
  await change('id');
  assert.equal(await page.locator('.lightbox-caption-text').innerText(), 'Judul');
  assert.equal(await page.locator('.lightbox-img').evaluate((image) => image.style.transform), transform);
  assert.equal(await page.locator('.lightbox-close').getAttribute('aria-label'), 'Tutup pratinjau');
  await page.locator('.lightbox-close').click();
  await change('en');
  await page.locator('#saveBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.locator('.result-download').waitFor({ timeout: 60000 });
  const filename = await page.locator('.result-copy > p').first().innerText();
  await change('id');
  assert.equal(await page.locator('.result-copy > p').first().innerText(), filename);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.result-download').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.pdf$/);
  await change('en');
  assert.equal((await page.locator('.result-download').innerText()).trim(), 'Downloaded');
  await page.locator('#newFileBtn').click();
  await change('id');
  assert.equal(await page.locator('#landing').isVisible(), true);
  console.log('PASS: live lightbox preserves zoom and raw caption; save, verified result, download and reset survive language changes');

  await page.evaluate(async () => {
    const { openReviewDialog } = await import('/assets/js/ui/review-dialog.js');
    void openReviewDialog({ mode: 'batch', plans: [{
      fileName: 'Judul', outputName: 'Judul', format: { label: 'PDF' },
      operations: [{ kind: 'field', action: 'set', label: 'Judul', before: 'Nilai', after: 'Judul' }],
      unchanged: { fields: 2, custom: 0, raw: 3 },
      memory: { estimatedLabel: '950 MB', level: 'block' },
      risks: [{ code: 'MEMORY', severity: 'danger', message: 'Perkiraan penggunaan memori tinggi.' }],
      extensionMismatch: { found: true, recommendedName: 'Judul', alternativeName: 'Nilai' },
    }] });
  });
  await page.locator('#reviewLowMemory').check();
  await page.locator('[name="review-ext-choice"][value="keep"]').check();
  await change('en');
  assert.match(await page.locator('.review-risks').innerText(), /Estimated memory use is high/);
  assert.equal(await page.locator('.review-ext-choice h3').innerText(), 'Extension does not match contents');
  assert.deepEqual(await page.locator('.review-ext-choice code').allTextContents(), ['Judul', 'Nilai']);
  assert.equal(await page.locator('.review-after').textContent(), 'Judul');
  assert.equal(await page.locator('.review-btn-confirm').innerText(), 'Apply anyway to 1 file');
  await change('id');
  assert.equal(await page.locator('#reviewLowMemory').isChecked(), true);
  assert.equal(await page.locator('[name="review-ext-choice"][value="keep"]').isChecked(), true);
  await page.locator('.review-btn-cancel').click();
  await page.evaluate(async () => {
    const { renderResultCard } = await import('/assets/js/ui/result-view.js');
    const { errorCard } = await import('/assets/js/editor/editor-shell.js');
    const { showToast } = await import('/assets/js/ui/toast.js');
    const integrity = { status: 'failed', summary: { checked: 3, expected: 1, preserved: 2 }, findings: [{ severity: 'error', message: 'Field "Judul" hilang padahal tidak diubah.', target: 'field:title', before: 'Nilai', after: 'Judul' }] };
    window.i18nReport = integrity; window.i18nReportOriginal = JSON.stringify(integrity);
    const host = document.createElement('div'); host.id = 'i18nSpecial';
    host.append(renderResultCard({ filename: 'Judul', integrity }, { onDownload() {} }), errorCard({ message: 'File tidak bisa dibaca.', detail: 'Raw library diagnostic: Judul' }));
    document.body.append(host);
    showToast('Versi baru MeInsert sudah tersedia.', 'info', 0, { label: 'Muat ulang', onClick() { window.i18nUpdateClicked = true; } });
  });
  await change('en');
  await page.locator('#i18nSpecial .result-integrity > summary').click();
  assert.match(await page.locator('#i18nSpecial .result-finding-head strong').innerText(), /Field "Title" was lost/);
  assert.equal(await page.locator('#i18nSpecial .result-finding-values').innerText(), 'Nilai → Judul');
  assert.equal(await page.locator('#i18nSpecial pre').innerText(), 'Raw library diagnostic: Judul');
  assert.match(await page.locator('.toast').last().innerText(), /A new version of MeInsert is available/);
  assert.equal(await page.locator('.toast-action').innerText(), 'Reload');
  assert.equal(await page.evaluate(() => JSON.stringify(window.i18nReport) === window.i18nReportOriginal), true);
  await page.locator('.toast-action').click();
  assert.equal(await page.evaluate(() => window.i18nUpdateClicked), true);
  await page.locator('#i18nSpecial').evaluate((node) => node.remove());
  console.log('PASS: memory/extension review options, integrity/error wrappers, immutable report values and update notification');

  await page.goto(`${base}/batch.html`);
  await page.locator('#batchBackBtn .icon svg').waitFor({ state: 'attached' });
  await page.locator('#batchFileInput').setInputFiles([join(root, 'tests/fixtures/document.pdf'), join(root, 'tests/fixtures/pattern.png')]);
  await page.waitForFunction(() => document.querySelectorAll('.batch-file.is-ready').length === 2, null, { timeout: 60000 });
  await page.locator('#batchCrossToggle').check();
  const batchInput = page.locator('#batch-cross-title');
  await batchInput.fill('Judul');
  await batchInput.evaluate((input) => { window.i18nBatchField = input; input.focus(); input.setSelectionRange(1, 3); });
  await change('id');
  assert.equal(await batchInput.inputValue(), 'Judul');
  assert.equal(await batchInput.evaluate((input) => input === window.i18nBatchField && input.selectionStart === 1 && input.selectionEnd === 3), true);
  assert.equal(await page.locator('#batchCrossToggle').isChecked(), true);
  await page.locator('#batchApplyBtn').click();
  await page.locator('#reviewLowMemory').check();
  await change('en');
  assert.equal(await page.locator('#reviewLowMemory').isChecked(), true);
  assert.equal(await page.locator('#reviewTitle').innerText(), 'Review batch changes');
  assert.match(await page.locator('.review-btn-confirm').innerText(), /^Apply to 2 files$/);
  await page.locator('.review-btn-cancel').click();
  await page.locator('.batch-file-main').first().click();
  await page.locator('#batchTabRaw').click();
  await page.locator('.batch-raw-search').fill('Title');
  await change('id');
  assert.equal(await page.locator('.batch-raw-search').inputValue(), 'Title');
  console.log('PASS: batch edits, caret, selection, low-memory review option, active detail and raw search preserved');

  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const name of ['index.html', 'single.html', 'batch.html']) {
      await page.goto(`${base}/${name}`);
      await change('id');
      await page.locator('[data-language-toggle]').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `mobile overflow: ${width} ${name}`);
      assert.equal(await page.locator('[data-language-toggle]').isVisible(), true);
      assert.equal(await page.locator('[data-language-toggle]').innerText(), 'EN');
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 360px/390px layouts on all three pages; no browser errors');

  const offline = await browser.newContext({ locale: 'en-US', serviceWorkers: 'allow' });
  const offlinePage = await offline.newPage();
  await offlinePage.goto(`${base}/index.html`);
  await offlinePage.evaluate(async () => { await navigator.serviceWorker.ready; });
  await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await offlinePage.waitForFunction(async () => (await caches.keys()).some((key) => key.startsWith('meinsert-')));
  await offlinePage.evaluate(async () => {
    for (const path of ['/TERMS.md', '/TERMS-en.md', '/PRIVACY.md', '/PRIVACY-en.md']) await fetch(path);
  });
  await offline.setOffline(true);
  for (const path of ['/TERMS.md', '/TERMS-en.md', '/PRIVACY.md', '/PRIVACY-en.md']) {
    assert.equal(await offlinePage.evaluate(async (url) => (await fetch(url)).ok, path), true, `offline policy: ${path}`);
  }
  for (const path of ['/index.html', '/single.html', '/batch.html']) {
    await offlinePage.goto(`${base}${path}`);
    await offlinePage.locator('[data-language-toggle]').click();
    assert.equal(await offlinePage.locator('html').getAttribute('lang'), 'id');
    await offlinePage.locator('[data-language-toggle]').click();
    assert.equal(await offlinePage.locator('html').getAttribute('lang'), 'en');
  }
  await offline.close();
  console.log('PASS: offline policies and ID/EN switching on all three cached pages');
} catch (error) {
  console.error('Browser errors:', errors);
  console.error('Current UI:', (await page.locator('body').innerText()).slice(-8000));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
