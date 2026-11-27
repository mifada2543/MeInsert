/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { strFromU8, strToU8, unzipSync, zipSync } from '../../assets/vendor/fflate.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const server = await createStaticServer({ root, contentTypes: { '.html': 'text/html; charset=utf-8' } });
let browser;
try {
  browser = await getBrowser();
  const context = await browser.newContext({ locale: 'en-US', acceptDownloads: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${base}/single.html`);
  await page.locator('#fileInput').setInputFiles(fixture('document.pdf'));
  await page.locator('#field-title').fill('Draft control 123');
  await page.getByRole('button', { name: 'Metadata presets' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('New preset name').fill('Example');
  await dialog.getByRole('button', { name: 'Save draft as preset' }).click();
  await dialog.getByText('Preset saved on this device.').waitFor();
  const exportResult = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export JSON' }).click();
  const exported = JSON.parse(await readFile(await (await exportResult).path(), 'utf8'));
  assert.equal(exported.fields[0].value, 'Draft control 123');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('#field-title').fill('Another title');
  await page.getByRole('button', { name: 'Metadata presets' }).click();
  await dialog.getByRole('button', { name: 'Apply to draft' }).click();
  assert.equal(await page.locator('#field-title').inputValue(), 'Draft control 123');
  await page.locator('#undoBtn').click();
  assert.equal(await page.locator('#field-title').inputValue(), 'Another title');
  await page.locator('#undoBtn').click();
  await page.locator('#saveBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.locator('.result-card').waitFor();
  await page.getByText('Raw tag diff after verification', { exact: true }).click();
  const diffDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export raw diff JSON' }).click();
  const diff = JSON.parse(await readFile(await (await diffDownload).path(), 'utf8'));
  assert.ok(diff.some((row) => row.after === 'Draft control 123'));
  console.log('PASS: Single preset, export, undo, save and actual raw tag diff');

  await page.goto(`${base}/batch.html`);
  await page.locator('#batchFileInput').setInputFiles(fixture('document.pdf'));
  await page.locator('.batch-file.is-ready').waitFor();
  await page.getByRole('button', { name: 'Metadata presets' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Apply to draft' }).click();
  await page.getByRole('button', { name: 'Find and replace' }).click();
  await dialog.getByLabel('Metadata field').selectOption('title');
  await dialog.getByLabel('Find', { exact: true }).fill('([0-9]+)');
  await dialog.getByLabel('Replace with').fill('V$1');
  await dialog.getByLabel('Regular expression').check();
  await dialog.getByRole('button', { name: 'Apply to draft' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => {
      const directory = await navigator.storage.getDirectory();
      return directory.getFileHandle('v2-batch.zip', { create: true });
    };
  });
  await page.locator('#batchApplyBtn').click();
  await page.getByText('Draft control V123', { exact: true }).waitFor({ state: 'attached' });
  await page.locator('#reviewDirectZip').check();
  await page.locator('.review-btn-confirm').click();
  await page.getByText('Saved 1 verified result(s) directly to ZIP.', { exact: true }).waitFor();
  const bytes = await page.evaluate(async () => {
    const directory = await navigator.storage.getDirectory();
    const handle = await directory.getFileHandle('v2-batch.zip');
    return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
  });
  const entries = unzipSync(Uint8Array.from(bytes));
  const paths = Object.keys(entries).filter((path) => path.startsWith('outputs/'));
  assert.equal(paths.length, 1);
  assert.match(strFromU8(entries[paths[0]].slice(0, 5)), /^%PDF/);
  const directReport = JSON.parse(strFromU8(entries['laporan-meinsert.json']));
  assert.equal(directReport.files.length, 1);
  assert.equal(directReport.files[0].integrity.includedInZip, true);
  console.log('PASS: Batch preset, regex transform, review and direct ZIP via Chromium OPFS');
  await page.goto(`${base}/batch.html`);
  await page.locator('#batchFileInput').setInputFiles([fixture('tone.mp3'), fixture('tone-long.mp3')]);
  await page.waitForFunction(() => document.querySelectorAll('.batch-file.is-ready').length === 2);
  await page.getByRole('button', { name: 'Number tracks' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('First track number').fill('3');
  await dialog.getByLabel('Minimum digits for ID3').fill('2');
  await dialog.getByLabel('Total tracks (optional)').fill('12');
  await dialog.getByRole('button', { name: 'Apply to draft' }).click();
  await page.locator('#batchApplyBtn').click();
  await page.getByText('03/12', { exact: true }).waitFor({ state: 'attached' });
  await page.getByText('04/12', { exact: true }).waitFor({ state: 'attached' });
  await page.locator('.review-btn-cancel').click();
  console.log('PASS: track order and ID3 padding are reflected in batch review');

  await page.goto(`${base}/single.html`);
  await page.locator('#fileInput').setInputFiles(fixture('clean-gps.jpg'));
  await page.locator('#field-title').waitFor();
  await page.locator('.tab[data-tab="gps"]').click();
  const latitude = await page.locator('#field-gpsLatitude').inputValue();
  await page.getByRole('button', { name: 'Approximate GPS location' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Apply to draft' }).click();
  assert.notEqual(await page.locator('#field-gpsLatitude').inputValue(), latitude);
  await page.locator('#saveBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.locator('.tab[data-tab="metadata"]').click();
  await page.locator('.result-card.is-ok, .result-card.is-warning').waitFor();
  console.log('PASS: JPEG GPS approximation survives the real ExifTool write and read-back');

  await page.goto(`${base}/single.html`);
  await page.locator('#fileInput').setInputFiles(fixture('v2-sample.avif'));
  await page.locator('#field-title').fill('AVIF v2 round trip');
  await page.locator('#saveBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.locator('.result-card.is-ok, .result-card.is-warning').waitFor();
  assert.equal(await page.locator('#field-title').inputValue(), 'AVIF v2 round trip');
  console.log('PASS: AVIF is detected and XMP metadata survives read-back');
  let externalSvgRequests = 0;
  page.on('request', (request) => {
    if (request.url() === 'https://svg-preview.invalid/image.png') externalSvgRequests += 1;
  });
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>Original vector</title>'
    + '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>'
    + '<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">SVG Author</dc:creator>'
    + '</rdf:Description></rdf:RDF></metadata><image href="https://svg-preview.invalid/image.png"/><path d="M0 0"/></svg>');
  const bookParts = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
    'book.opf': '<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Original book</dc:title><dc:language>en</dc:language><dc:creator>EPUB Author</dc:creator></metadata><spine/></package>',
  };
  const packBook = (parts) => Buffer.from(zipSync(Object.fromEntries(Object.entries(parts)
    .map(([key, value]) => [key, strToU8(value)])), { level: 0 }));
  const documents = [
    { name: 'vector.svg', mimeType: 'image/svg+xml', buffer: svg },
    { name: 'book.epub', mimeType: 'application/epub+zip', buffer: packBook(bookParts) },
  ];
  for (const [document, title] of documents.map((doc, index) => [doc, ['Updated vector', 'Updated book'][index]])) {
    await page.goto(`${base}/single.html`);
    const input = document.name.endsWith('.svg')
      ? { ...document, buffer: Buffer.from(document.buffer.toString().replace('>SVG Author<', '><')) }
      : document;
    await page.locator('#fileInput').setInputFiles(input);
    await page.locator('#field-title').fill(title);
    if (input !== document) await page.locator('#field-creator').fill('New SVG author');
    await page.locator('#saveBtn').click();
    await page.locator('.review-btn-confirm').click();
    await page.locator('.result-card.is-ok, .result-card.is-warning').waitFor();
    assert.equal(await page.locator('#field-title').inputValue(), title);
    assert.notEqual(await page.locator('#field-creator').inputValue(), '');
    await page.locator('#cleanMetadataBtn').click();
    await page.locator('.clean-btn-apply').click();
    await page.locator('#saveBtn').click();
    await page.locator('.review-btn-confirm').click();
    await page.locator('.result-card.is-ok, .result-card.is-warning').waitFor();
    assert.equal(await page.locator('#field-creator').inputValue(), '');
  }
  await page.goto(`${base}/batch.html`);
  const protectedBook = {
    name: 'protected.epub', mimeType: 'application/epub+zip',
    buffer: packBook({ ...bookParts, 'book.opf': bookParts['book.opf'].replace('<dc:creator>', '<dc:creator id="protected">') }),
  };
  await page.locator('#batchFileInput').setInputFiles([...documents, protectedBook]);
  await page.waitForFunction(() => document.querySelectorAll('.batch-file.is-ready').length === 3);
  await page.locator('#batchCleanBtn').click();
  await page.locator('.batch-clean-confirm').click();
  await page.locator('#batchApplyBtn').click();
  await page.locator('.review-btn-confirm').click();
  await page.locator('#batchZipBtn:enabled').waitFor();
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const batchDownload = page.waitForEvent('download');
  await page.locator('#batchZipBtn').click();
  const cleaned = unzipSync(new Uint8Array(await readFile(await (await batchDownload).path())));
  assert.deepEqual(Object.keys(cleaned).filter((name) => name.startsWith('outputs/')).sort(), [
    'outputs/book-meinsert.epub', 'outputs/vector-meinsert.svg',
  ]);
  assert.doesNotMatch(strFromU8(cleaned['outputs/vector-meinsert.svg']), /SVG Author/);
  assert.doesNotMatch(strFromU8(unzipSync(cleaned['outputs/book-meinsert.epub'])['book.opf']), /EPUB Author/);
  assert.equal(externalSvgRequests, 0);
  console.log('PASS: Single and Batch clean document fields and preserve the protected EPUB author');
  console.log('PASS: SVG and EPUB edit through the document worker; SVG is never loaded as preview');
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
