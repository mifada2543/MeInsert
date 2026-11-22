/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */


import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
const DEFAULT_TYPES = new Map([
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
]);
function lookup(types, filePath) {
  const extension = extname(filePath);
  return types.get(extension) || DEFAULT_TYPES.get(extension);
}
export function createStaticServer({ root, contentTypes, traversalStatus = 404, intercept }) {
  const types = new Map([...DEFAULT_TYPES, ...(contentTypes instanceof Map ? contentTypes : new Map(Object.entries(contentTypes || {})))]);
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    if (intercept?.(pathname, response)) return;
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
    response.writeHead(200, { 'content-type': lookup(types, filePath) || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}