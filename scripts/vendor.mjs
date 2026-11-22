/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */












import { mkdir, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { build } from 'esbuild';
import { optimizeExifTool, sha256, upstreamName } from './optimize-exiftool.mjs';
import { promisify } from 'node:util';
const gzipAsync = promisify(gzip);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const vendor = join(root, 'assets', 'vendor');
const licenses = join(vendor, 'licenses');
const licenseHeader = (await readFile(fileURLToPath(import.meta.url), 'utf8')).split('\n').slice(0, 3).join('\n') + '\n';
const copies = [
  ['@colorhythm/exiftool-wasm/LICENSE', 'licenses/exiftool-wasm-LICENSE'],
  ['mediabunny/dist/bundles/mediabunny.min.mjs', 'mediabunny.mjs'],
  ['mediabunny/LICENSE', 'licenses/mediabunny-LICENSE'],
  ['pdf-lib/dist/pdf-lib.esm.min.js', 'pdf-lib.esm.js'],
  ['pdf-lib/LICENSE.md', 'licenses/pdf-lib-LICENSE.md'],
  ['browser-id3-writer/dist/browser-id3-writer.mjs', 'browser-id3-writer.mjs'],
  ['browser-id3-writer/LICENSE.md', 'licenses/browser-id3-writer-LICENSE.md'],
  ['fflate/esm/browser.js', 'fflate.mjs'],
  ['fflate/LICENSE', 'licenses/fflate-LICENSE'],
  ['base64-js/LICENSE', 'licenses/base64-js-LICENSE'],
];
await mkdir(vendor, { recursive: true });
await mkdir(licenses, { recursive: true });
for (const [from, to] of copies) {
  const src = join(nm, from);
  const dest = join(vendor, to);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  console.log(`copied ${from}`);
}

await build({
  absWorkingDir: root,
  entryPoints: [join(nm, 'brotli', 'decompress.js')],
  outfile: join(vendor, 'brotli-decode.mjs'),
  platform: 'browser',
  format: 'esm',
  bundle: true,
  minify: true,
  legalComments: 'none',
});
const decoderPath = join(vendor, 'brotli-decode.mjs');
await writeFile(decoderPath, licenseHeader + await readFile(decoderPath, 'utf8'));

if (!process.argv.includes('--reuse-engine')) {
  const wasmDir = join(nm, '@colorhythm', 'exiftool-wasm', 'dist', 'esm');
  const engineDir = join(vendor, 'exiftool-wasm');
  const manifestUrl = new URL('../assets/js/core/image-engine-build.js', import.meta.url);
  const { exiftoolBuild: previous } = await import(manifestUrl);
  const wasm = optimizeExifTool(await readFile(join(wasmDir, upstreamName)));
  const hash = sha256(wasm);
  const name = `zeroperl-${hash.slice(0, 12)}.wasm`;
  const [gz, br] = await Promise.all([
    gzipAsync(wasm, { level: 9 }),
    promisify(brotliCompress)(wasm, { params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_LGWIN]: 24,
    } }),
  ]);
  const loader = (await readFile(join(wasmDir, 'index.js'), 'utf8'))
    .split('\n').filter((line) => !line.startsWith('//#')).join('\n');
  if (!loader.includes(upstreamName)) throw new Error('Upstream ExifTool loader changed.');
  await mkdir(engineDir, { recursive: true });
  await writeFile(join(engineDir, 'index.js'), loader.replaceAll(upstreamName, name));
  await writeFile(join(engineDir, `${name}.gz`), gz);
  await writeFile(join(engineDir, `${name}.br`), br);
  const manifest = {
    name, sha256: hash, rawBytes: wasm.length, gzipBytes: gz.length,
    brotliBytes: br.length, brotliSha256: sha256(br),
  };
  await writeFile(manifestUrl,
    `${licenseHeader}export const exiftoolBuild = Object.freeze(${JSON.stringify(manifest, null, 2)});
`);
  const swPath = join(root, 'sw.js');
  const sw = await readFile(swPath, 'utf8');
  const formatInteger = (value) => value.toLocaleString('en-US').replaceAll(',', '_');
  await writeFile(swPath, sw.replaceAll(previous.name, name).replaceAll(previous.sha256, hash)
    .replaceAll(formatInteger(previous.rawBytes), formatInteger(wasm.length)));
  if (previous.name !== name) {
    for (const ext of ['gz', 'br']) await rm(join(engineDir, `${previous.name}.${ext}`), { force: true });
  }
  console.log(`ExifTool: ${wasm.length} raw, ${gz.length} gzip, ${br.length} Brotli (${name}).`);
}
