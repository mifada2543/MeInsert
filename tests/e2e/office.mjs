/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { join } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const fixturesDir = join(root, 'tests/fixtures');
const fixture = (name) => join(fixturesDir, name);
const has = (name) => existsSync(fixture(name));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docm': 'application/vnd.ms-word.document.macroEnabled.12',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
};
function serve() {
  return createStaticServer({ root, contentTypes, traversalStatus: 404 });
}
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium not found. Set CHROME_BIN to the browser executable path.');
  return found;
}
async function openBatchOptions(page) {
  const toggle = page.locator('#batchOptionsToggle');
  if (await toggle.count() && await toggle.isVisible()
      && !(await page.locator('#batchOptions').isVisible())
      && (await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}
function skip(name, reason) {
  console.log(`SKIP: ${name} — ${reason}`);
}
async function openSingle(page, base, file) {
  await page.goto(`${base}/single.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#fileInput').setInputFiles(file);
}
async function waitForRead(page, label) {
  await page.waitForFunction(() => Boolean(document.querySelector('#field-title'))
    || Boolean(document.querySelector('.error-card, #readStatus.is-error, .toast.is-error')), null, { timeout: 60000 });
  if (!(await page.locator('#field-title').count())) {
    const detail = (await page.locator('.error-card, #readStatus, .toast.is-error').allTextContents()).join(' | ');
    throw new Error(`${label}: the editor could not read the Office file: ${detail}`);
  }
}
async function editSaveAndReread(page, base, file, sourceName, label) {
  await openSingle(page, base, file);
  await waitForRead(page, label);
  const preview = await page.evaluate(() => {
    const frame = document.querySelector('.file-card--top .preview-frame');
    const summary = document.querySelector('.file-card--top .office-preview');
    return {
      kind: frame?.className || '',
      title: summary?.querySelector('.office-preview-title')?.textContent || '',
      hint: summary?.querySelector('.office-preview-hint')?.textContent || '',
    };
  });
  assert.match(preview.kind, /preview-frame--office/, `${label}: office preview replaces the generic file icon`);
  assert.equal(preview.title, 'Contoh Judul', `${label}: preview shows the document title`);
  assert.match(preview.hint, /metadata/i, `${label}: preview is labeled as a metadata summary`);
  assert.equal(await page.locator('#field-title').inputValue(), 'Contoh Judul', `${label}: the source title was read`);
  await page.locator('#field-title').fill('Judul Diubah');
  await page.locator('#field-title').blur();
  await page.locator('#saveBtn').click();
  await page.locator('.review-card').waitFor({ timeout: 30000 });
  await page.locator('.review-btn-confirm').click();
  await page.locator('.result-card').waitFor({ timeout: 120000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('.result-download').first().click();
  const download = await downloadPromise;
  const name = download.suggestedFilename();
  assert.ok(name.toLowerCase().endsWith(`.${sourceName.split('.').pop()}`), `${label}: download keeps the ${sourceName} extension (got ${name})`);
  const saved = join(tempDir, `reread-${label}.${sourceName.split('.').pop()}`);
  await download.saveAs(saved);
  await openSingle(page, base, saved);
  await waitForRead(page, `${label} re-read`);
  assert.equal(await page.locator('#field-title').inputValue(), 'Judul Diubah', `${label}: the re-read output reflects the saved title`);
  console.log(`PASS: ${label} edits, writes and re-reads a .${sourceName.split('.').pop()} download`);
}
const officeFixtures = [
  'sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.docm',
  'sample.xlsm', 'sample.pptm', 'sample.odt', 'sample.ods', 'sample.odp',
];
if (!officeFixtures.some(has) && !has('signed.docx') && !has('encrypted.docx')) {
  console.log('SKIP: no Office fixtures are present in tests/fixtures; the Office E2E suite did not run.');
  process.exit(0);
}
if (!existsSync(join(root, 'assets/js/formats/office.js'))) {
  console.log('SKIP: assets/js/formats/office.js is not wired yet; the Office E2E suite did not run.');
  process.exit(0);
}
const tempDir = mkdtempSync(join(tmpdir(), 'meinsert-office-e2e-'));
const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  rmSync(tempDir, { recursive: true, force: true });
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const browser = await getBrowser({
  executablePath: findChrome(),
  headless: true,
  args: ['--disable-dev-shm-usage'],
});
const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
try {
  await page.goto(`${base}/batch.html`, { waitUntil: 'domcontentloaded' });
  const accepts = await page.evaluate(() => [...document.querySelectorAll('input[type="file"]')]
    .map((input) => input.getAttribute('accept') || ''));
  assert.ok(accepts.length >= 2, 'batch exposes both file inputs');
  for (const ext of ['.docx', '.docm', '.xlsx', '.xlsm', '.pptx', '.pptm', '.odt', '.ods', '.odp']) {
    for (const accept of accepts) {
      assert.ok(accept.includes(ext), `batch file picker hides ${ext} unless "All files" is selected`);
    }
  }
  console.log('PASS: batch file picker lists every supported Office format');
  for (const [name, family] of [['sample.docx', 'OOXML'], ['sample.odt', 'ODF'], ['sample.docm', 'macro']]) {
    if (!has(name)) {
      skip(`single-editor ${family}`, `tests/fixtures/${name} is missing`);
      continue;
    }
    await editSaveAndReread(page, base, fixture(name), name, family);
    if (name === 'sample.docm') {
      const macroNotice = await page.evaluate(() => {
        const text = document.body.innerText;
        return /makro|macro/i.test(text)
          || document.querySelectorAll('.file-warning, .toast, .review-risk').length > 0;
      });
      console.log(macroNotice
        ? `PASS: ${family} fixture surfaced a macro warning/notice in the UI`
        : `WARN: ${family} fixture did not surface a macro warning/notice yet (not wired); report only`);
    }
  }
  if (!has('signed.docx')) {
    skip('signed document warning', 'tests/fixtures/signed.docx is missing');
  } else {
    await openSingle(page, base, fixture('signed.docx'));
    await waitForRead(page, 'signed document');
    await page.locator('#field-title').fill('Tanda tangan diuji');
    await page.locator('#field-title').blur();
    await page.locator('#saveBtn').click();
    await page.locator('.review-card').waitFor({ timeout: 30000 });
    const reviewText = (await page.locator('.review-card').innerText()).toLowerCase();
    const hasIndicator = await page.locator('.review-risk.is-danger, .review-risk.is-warning, .review-btn-confirm.is-danger').count() > 0;
    assert.ok(hasIndicator || /tanda tangan|signature|invalid|ttd/i.test(reviewText), 'the signed document shows a danger/warning in review');
    assert.ok(/tanda tangan|signature|invalid|ttd|ditandatangani/i.test(reviewText), 'the review step keeps the signature warning text');
    assert.equal(await page.locator('.review-btn-confirm').isEnabled(), true, 'the signed write is still allowed');
    await page.locator('.review-btn-confirm').click();
    await page.locator('.result-card').waitFor({ timeout: 120000 });
    console.log('PASS: signed document warns in review and still allows a deliberate write');
  }
  if (!has('encrypted.docx')) {
    skip('encrypted document rejection', 'tests/fixtures/encrypted.docx is missing');
  } else {
    await openSingle(page, base, fixture('encrypted.docx'));
    await page.waitForFunction(() => {
      const status = document.querySelector('#readStatus');
      return (status?.classList.contains('is-error') && status.textContent.trim().length > 0)
        || Boolean(document.querySelector('.toast.is-error, .error-card'));
    }, null, { timeout: 60000 });
    const errorText = await page.evaluate(() => {
      const status = document.querySelector('#readStatus');
      return [status?.classList.contains('is-error') ? status.textContent : '',
        ...[...document.querySelectorAll('.toast.is-error, .error-card')].map((node) => node.textContent),
      ].join(' ').trim();
    });
    assert.ok(errorText.length > 0, 'encrypted rejection produces a clear error card/toast');
    assert.equal(await page.locator('.result-card').count(), 0, 'no silent success for an encrypted file');
    assert.equal(await page.locator('#saveBtn').isDisabled(), true, 'an encrypted file cannot be saved');
    console.log(`PASS: encrypted document is rejected with a clear error and no silent success (${errorText.slice(0, 120)})`);
  }
  if (!has('sample.docx') || !has('sample.odt')) {
    skip('batch cross-format', 'tests/fixtures/sample.docx and sample.odt are both required');
  } else {
    await page.goto(`${base}/batch.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#batchFileInput').setInputFiles([fixture('sample.docx'), fixture('sample.odt')]);
    await page.waitForFunction(() => document.querySelectorAll('.batch-file.is-ready').length === 2,
      null, { timeout: 60000 });
    const groups = await page.evaluate(() => [...document.querySelectorAll('.batch-group')].map((group) => ({
      key: group.getAttribute('data-group-key') || '',
      files: group.querySelectorAll('.batch-file.is-ready').length,
    })).filter((group) => group.files > 0));
    assert.ok(groups.length >= 1, 'the two office files produced at least one batch group');
    assert.ok(groups.some((group) => /office/i.test(group.key)), `an office group was produced (${JSON.stringify(groups)})`);
    const total = groups.reduce((sum, group) => sum + group.files, 0);
    assert.equal(total, 2, `both office files are represented in the groups (${JSON.stringify(groups)})`);
    assert.ok(groups.length === 1 || groups.length === 2,
      `either one office group with two files or two groups with one file (${JSON.stringify(groups)})`);
    console.log(`PASS: batch produced ${groups.length === 1 ? 'one office group with two files' : 'two office groups with one file each'}`);
    await page.locator('.batch-file-main').first().click();
    await page.waitForFunction(() => Boolean(document.querySelector('.batch-preview-stage--office .office-preview')), null, { timeout: 30000 });
    const batchPreview = await page.evaluate(() => ({
      title: document.querySelector('.batch-preview-stage--office .office-preview-title')?.textContent || '',
      hasOpenLink: Boolean(document.querySelector('.batch-preview-stage--office .batch-preview-open')),
    }));
    assert.equal(batchPreview.title, 'Contoh Judul', 'batch office preview shows the document title');
    assert.equal(batchPreview.hasOpenLink, false, 'batch office preview does not create a useless blob link');
    console.log('PASS: batch office preview shows a document summary without an object URL');
    await page.locator('#batchDetailBackBtn').click();
    await page.locator('#batchGroups').waitFor({ state: 'visible' });
    const groupCount = await page.locator('.batch-group').count();
    for (let index = 0; index < groupCount; index++) {
      const title = page.locator('.batch-group').nth(index).locator('[data-field-id="title"] .field-input');
      if (await title.count()) await title.fill('Judul Batch Campuran');
    }
    await page.locator('#batchApplyBtn').click();
    await page.locator('.review-btn-confirm').click();
    await page.waitForFunction(() => !document.querySelector('#batchGroups')?.inert
      && /selesai/.test(document.querySelector('#batchStatus')?.textContent || ''), null, { timeout: 60000 });
    const status = await page.locator('#batchStatus').innerText();
    assert.match(status, /2 selesai/, `both office files succeeded (${status})`);
    assert.doesNotMatch(status, /[1-9]\d*\s+gagal/, `no batch failures (${status})`);
    await page.evaluate(() => {
      window.__reportBlobs = [];
      const original = URL.createObjectURL;
      URL.createObjectURL = function patched(blob) {
        window.__reportBlobs.push(blob);
        return original.call(this, blob);
      };
    });
    await openBatchOptions(page);
    await page.locator('#batchReportJsonBtn').click();
    const reportText = await page.evaluate(async () => {
      const blob = window.__reportBlobs.at(-1);
      return blob ? blob.text() : '';
    });
    assert.ok(reportText, 'the batch JSON report was produced');
    const report = JSON.parse(reportText);
    const names = (report.files || []).map((file) => file.name || file.fileName || file.filename || '');
    assert.ok(names.some((name) => /\.docx$/i.test(name)) && names.some((name) => /\.odt$/i.test(name)),
      `the report covers both files (${JSON.stringify(names)})`);
    console.log('PASS: cross-format batch saved both office files and the report lists both');
  }
  if (!has('sample.docx')) {
    skip('clean metadata', 'tests/fixtures/sample.docx is missing');
  } else {
    await page.goto(`${base}/single.html?clean=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(new URL(page.url()).searchParams.get('clean'), null, '?clean=1 is stripped from the URL');
    await page.locator('#fileInput').setInputFiles(fixture('sample.docx'));
    await page.waitForFunction(() => Boolean(document.querySelector('.clean-card'))
      || Boolean(document.querySelector('.error-card, #readStatus.is-error, .toast.is-error')), null, { timeout: 60000 });
    if (!(await page.locator('.clean-card').count())) {
      const detail = (await page.locator('.error-card, #readStatus, .toast.is-error').allTextContents()).join(' | ');
      throw new Error(`clean metadata: the editor could not read the Office file: ${detail}`);
    }
    await page.locator('#cleanProfile-privacy').check();
    await page.locator('.clean-btn-apply').click();
    await page.locator('.clean-card').waitFor({ state: 'detached', timeout: 15000 });
    await page.locator('#saveBtn').click();
    await page.locator('.review-card').waitFor({ timeout: 30000 });
    const reviewText = (await page.locator('.review-card').innerText()).toLowerCase();
    assert.ok(/creator|last.?modif(?:ied)?.?by/.test(reviewText),
      `review removals include dc:creator / cp:lastModifiedBy (${reviewText.slice(0, 400)})`);
    await page.locator('.review-btn-confirm').click();
    await page.locator('.result-card').waitFor({ timeout: 120000 });
    console.log('PASS: clean panel removes office identity fields and completes without page errors');
  }
  assert.deepEqual(errors, [], `no page errors (${errors.join(' | ')})`);
  console.log('PASS: Office E2E suite finished with no page errors');
} catch (error) {
  console.error('Current UI:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  rmSync(tempDir, { recursive: true, force: true });
}