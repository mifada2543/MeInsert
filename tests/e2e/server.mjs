/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Shared local static server for E2E suites. Only test infrastructure: it is
// never loaded by the application or the service worker.
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

function lookup(contentTypes, filePath) {
  const extension = extname(filePath);
  return contentTypes instanceof Map ? contentTypes.get(extension) : contentTypes[extension];
}

/**
 * Serve repository files on an ephemeral localhost port.
 * `traversalStatus` keeps the two historical behaviours: 404 in most suites,
 * 403 in suites that explicitly assert path traversal handling.
 */
export function createStaticServer({ root, contentTypes, traversalStatus = 404 }) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    const filePath = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(traversalStatus, traversalStatus === 403 ? 'Forbidden' : 'Not found').end(
        traversalStatus === 403 ? 'Forbidden' : 'Not found',
      );
      return;
    }
    if (!existsSync(filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': lookup(contentTypes, filePath) || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
