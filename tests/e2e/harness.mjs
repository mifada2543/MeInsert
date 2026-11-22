/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Shared browser harness: one Chrome process for every E2E suite. */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Set CHROME_BIN to Chrome/Chromium executable');
  return found;
}
export async function getBrowser() {
  const endpoint = process.env.MEINSERT_CDP_ENDPOINT;
  const browser = endpoint
    ? await chromium.connectOverCDP(endpoint)
    : await chromium.launch({
        executablePath: findChrome(),
        headless: true,
        args: ['--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check'],
      });
  const contexts = new Set();
  return new Proxy(browser, {
    get(target, prop, receiver) {
      if (prop === 'newContext') {
        return async (...args) => {
          const context = await target.newContext(...args);
          contexts.add(context);
          return context;
        };
      }
      if (prop === 'close') {
        return async () => {
          for (const context of contexts) await context.close().catch(() => {});
          contexts.clear();
          await target.close().catch(() => {});
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}