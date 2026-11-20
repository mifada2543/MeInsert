/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { getBrowser } from './harness.mjs';
import { createStaticServer } from './server.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const PROFILE_KEY = 'meinsert.offlineProfile';
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
const server = await serve();
const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Could not start local server.');
}
const base = `http://127.0.0.1:${address.port}`;
const browser = await getBrowser({
  executablePath: findChrome(),
  headless: true,
  args: ['--disable-dev-shm-usage'],
});
const context = await browser.newContext({ locale: 'id-ID', serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
const external = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => { dialog.accept().catch(() => {}); });
page.on('request', (request) => {
  const url = request.url();
  if (/^(?:data:|blob:)/.test(url)) return;
  try {
    if (new URL(url).hostname !== '127.0.0.1') external.push(url);
  } catch { /* non-URL request */ }
});
const mount = () => page.evaluate(async () => {
  const module = await import('/assets/js/ui/offline-settings.js');
  module.initOfflineSettings();
  return Boolean(document.getElementById('settingsBtn'));
});
const openDialog = async () => {
  await page.locator('#settingsBtn').click();
  await page.waitForFunction(() => document.getElementById('offlineSettingsDialog')?.open === true);
};
const readProfile = () => page.evaluate(async () => {
  const module = await import('/assets/js/core/offline-manifest.js');
  return module.getProfile(localStorage);
});
try {
  for (const name of ['index.html', 'single.html', 'batch.html']) {
    await page.goto(`${base}/${name}`);
    assert.equal(await mount(), true, `${name} should mount the settings button`);
    const button = page.locator('#settingsBtn');
    assert.equal(await button.count(), 1, `${name} should have exactly one gear button`);
    assert.equal(await button.evaluate((node) => node.classList.contains('icon-button')), true, `${name} gear must use the icon-button style`);
    assert.equal(await button.evaluate((node) => Boolean(node.closest('.header-actions'))), true, `${name} gear must live in .header-actions`);
    assert.equal(await button.evaluate((node) => node.querySelectorAll('svg path').length > 0), true, `${name} gear must use a stroke SVG`);
    assert.ok(await button.getAttribute('aria-label'), `${name} gear must have an accessible label`);
  }
  console.log('PASS: idempotent gear button with stroke SVG and accessible label exists in .header-actions on index, single and batch');
  await page.evaluate((key) => localStorage.removeItem(key), PROFILE_KEY);
  await page.reload();
  await mount();
  assert.deepEqual(await readProfile(), { mode: 'frugal', features: [], updatedAt: 0 });
  await openDialog();
  assert.equal(await page.locator('#offlineSettingsDialog').getAttribute('role'), 'dialog');
  assert.equal(await page.locator('#offlineMode-frugal').isChecked(), true);
  assert.equal(await page.locator('#offlineMode-selected').isChecked(), false);
  assert.equal(await page.locator('#offlineMode-all').isChecked(), false);
  assert.match(await page.locator('#offlineSettingsTitle').innerText(), /Penyimpanan & Offline/);
  assert.equal(await page.locator('#offlineFeature-audio').count(), 1);
  assert.equal(await page.locator('#offlineFeature-image').count(), 1);
  assert.equal(await page.locator('#offlineFeature-pdf').count(), 1);
  assert.equal(await page.locator('#offlineFeature-office').count(), 1);
  console.log('PASS: dialog opens with role=dialog, translated title, three radio modes, four feature checkboxes and a frugal default profile');
  await page.locator('#offlineMode-all').click();
  const saved = await readProfile();
  assert.equal(saved.mode, 'all');
  assert.equal(saved.features.length, 4);
  assert.ok(saved.updatedAt > 0);
  await page.reload();
  await mount();
  await openDialog();
  assert.equal(await page.locator('#offlineMode-all').isChecked(), true, 'all mode must survive a reload');
  console.log('PASS: selecting all modes persists through setProfile, survives reload and restores the checked radio');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => ({ saveData: true, effectiveType: '4g' }),
    });
  });
  await openDialog();
  assert.equal(await page.locator('#offlineMode-frugal').isChecked(), true);
  assert.equal(await page.locator('#offlineMode-selected').isDisabled(), true);
  assert.equal(await page.locator('#offlineMode-all').isDisabled(), true);
  assert.equal(await page.locator('.offline-settings__note').isVisible(), true);
  assert.match(await page.locator('.offline-settings__note').innerText(), /Save-Data/);
  assert.equal((await readProfile()).mode, 'frugal', 'Save-Data must persist the forced frugal profile');
  console.log('PASS: emulated Save-Data forces frugal, disables selected/all, shows the note and persists the safe profile');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('offlineSettingsDialog')?.open === false);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('meinsert:open-settings')));
  await page.waitForFunction(() => document.getElementById('offlineSettingsDialog')?.open === true);
  console.log('PASS: Escape closes the dialog and the meinsert:open-settings window event opens it');
  const versions = await page.evaluate(async () => {
    const build = await import('/assets/js/core/build.js');
    return { shell: build.CURRENT_VERSION, engine: build.ENGINE_VERSION };
  });
  assert.ok(versions.shell && versions.engine, 'both cache markers must be exported by build.js');
  assert.notEqual(versions.engine, versions.shell, 'shell and engine caches must be versioned independently');
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      mode: 'all', features: ['audio', 'image', 'pdf', 'office'], updatedAt: Date.now(), version: 1,
    }));
  }, PROFILE_KEY);
  await page.reload();
  await mount();
  await page.evaluate(() => {
    window.__swMessages = [];
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {
          postMessage(message, transfer) {
            window.__swMessages.push(message);
            if (Array.isArray(transfer) && transfer[0]) window.__swPort = transfer[0];
          },
        },
      },
    });
  });
  await openDialog();
  await page.locator('#offlineMode-selected').click();
  const imageStatus = page.locator('label[for="offlineFeature-image"] .offline-settings__feature-status');
  assert.equal(await imageStatus.innerText(), 'Belum diunduh');
  await page.evaluate(async () => {
    const { features } = await import('/assets/js/core/format-capabilities.js');
    const image = features().find((feature) => feature.id === 'image');
    window.__swPort.postMessage({ type: 'OPTIONAL_STATUS_RESULT', urls: image.urls });
  });
  await page.waitForFunction(() => document.querySelector('label[for="offlineFeature-image"] .offline-settings__feature-status')?.textContent === 'Siap offline');
  await page.evaluate(() => window.__swPort.postMessage({ type: 'OPTIONAL_CLEARED' }));
  await page.waitForFunction(() => document.querySelector('label[for="offlineFeature-image"] .offline-settings__feature-status')?.textContent === 'Belum diunduh');
  await page.locator('#offlineMode-all').click();
  await page.locator('.offline-settings__download').click();
  await page.evaluate(() => {
    const start = window.__swMessages.find((message) => message.type === 'CACHE_OPTIONAL');
    window.__swPort.postMessage({
      type: 'OPTIONAL_DONE',
      jobId: start?.jobId,
      version: start?.version,
      cached: 1,
      failed: 0,
      total: 1,
    });
  });
  await page.locator('.offline-settings__clear').click();
  const messages = await page.evaluate(() => window.__swMessages);
  for (const type of ['OPTIONAL_STATUS', 'CACHE_OPTIONAL', 'CLEAR_OPTIONAL']) {
    assert.ok(messages.some((message) => message.type === type), `${type} must be sent to the worker`);
    assert.ok(messages.filter((message) => message.type === type).every((message) => message.version === versions.engine),
      `${type} must carry the engine version, not the shell version`);
    assert.ok(messages.filter((message) => message.type === type).every((message) => message.version !== versions.shell),
      `${type} must not be invalidated by a shell-only update`);
  }
  const download = messages.find((message) => message.type === 'CACHE_OPTIONAL');
  assert.ok(download.urls.length > 10, 'the download must cover every optional engine URL');
  console.log('PASS: OPTIONAL_STATUS, CACHE_OPTIONAL and CLEAR_OPTIONAL all use the independent engine version');
  assert.deepEqual(external, [], `unexpected external requests: ${external.join('; ')}`);
  console.log('PASS: no requests left the same origin');
  assert.deepEqual(errors, [], `unexpected page errors: ${errors.join('; ')}`);
  console.log('PASS: no page errors during any offline-settings scenario');
} catch (error) {
  console.error('Browser errors:', errors);
  console.error('External requests:', external);
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}