/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* One Chrome process + one CDP endpoint for every E2E suite. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const allSuites = [
  'smoke',
  'i18n',
  'single-undo-redo',
  'batch-undo-redo',
  'security',
  'engine-loading',
  'wasm-integrity',
  'timed-text',
  'quick-save',
  'clean-metadata',
  'batch-clean',
  'policy-notice',
  'office',
  'about',
  'offline-settings',
  'scroll-reveal',
  'action-bar',
  'preview-animation',
  'cut-media',
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function option(name) {
  const flag = process.argv.slice(2).find((argument) => argument.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3) : undefined;
}
function selectSuites() {
  const explicit = option('suites') || process.env.MEINSERT_SUITES;
  if (explicit) {
    const chosen = explicit.split(',').map((name) => name.trim()).filter(Boolean);
    assert.ok(chosen.length, 'MEINSERT_SUITES is empty');
    for (const name of chosen) assert.ok(allSuites.includes(name), `Unknown E2E suite: ${name}`);
    return chosen;
  }
  const shard = option('shard') || process.env.MEINSERT_E2E_SHARD;
  if (!shard) return allSuites;
  const [number, total] = shard.split('/').map(Number);
  assert.ok(Number.isInteger(number) && Number.isInteger(total) && total > 0 && number > 0 && number <= total,
    `Invalid shard "${shard}" (expected N/T)`);
  return allSuites.filter((_, index) => index % total === number - 1);
}
const suites = selectSuites();
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  assert.ok(found, 'Set CHROME_BIN to Chrome/Chromium executable');
  return found;
}
async function freePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
async function cdpEndpoint(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
      if (response.ok) {
        const { webSocketDebuggerUrl } = await response.json();
        if (webSocketDebuggerUrl) return webSocketDebuggerUrl;
      }
    } catch { /* Chrome is still starting */ }
    await sleep(100);
  }
  throw new Error(`Chrome CDP endpoint did not come up on port ${port}`);
}
function runSuite(name, endpoint) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, `${name}.mjs`)], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, MEINSERT_CDP_ENDPOINT: endpoint },
    });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}
const port = await freePort();
const browser = await chromium.launch({
  executablePath: findChrome(),
  headless: true,
  args: [`--remote-debugging-port=${port}`, '--remote-allow-origins=*', '--hide-scrollbars'],
});
const failures = [];
try {
  const endpoint = await cdpEndpoint(port);
  console.log(`Shared Chrome ready (CDP :${port}) — running ${suites.length} E2E suites\n`);
  for (const suite of suites) {
    const ok = await runSuite(suite, endpoint);
    if (!ok) failures.push(suite);
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`\n${failures.length}/${suites.length} E2E suites failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`\n${suites.length}/${suites.length} E2E suites passed with one shared Chrome process.`);
}