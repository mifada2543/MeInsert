/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const upstreamName = 'zeroperl-twnm61dk.wasm';
const upstreamHash = 'f854cbb7b6b014d2816a89428fcb217162bb0d7e65f2078f3bbd4b72eaa412ce';
const dataOffset = 4_003_822;
const dataAddress = 8_388_608;
const fileTable = 22_708_926;
const fileCount = 523;
const exiftoolPath = '/zeroperl/lib/5.42.0/wasm32-wasi/Image/';


const nativeFormats = new Set([
  'AAC.pm', 'AIFF.pm', 'FLAC.pm', 'Matroska.pm', 'Ogg.pm', 'Opus.pm',
  'Vorbis.pm',
]);
const unsupportedFormats = new Set([
  '7Z.pm', 'Audible.pm', 'BPG.pm', 'BZZ.pm', 'DICOM.pm', 'DV.pm',
  'DjVu.pm', 'Flash.pm', 'ISO.pm', 'ITC.pm', 'LNK.pm',
  'M2TS.pm', 'MPC.pm', 'Palm.pm',
  'RTF.pm', 'Real.pm', 'Text.pm', 'Torrent.pm', 'VCard.pm',
  'WTV.pm', 'WavPack.pm', 'XISF.pm',
]);
const unusedResources = new Set(['BuildTagLookup.pm', 'Geolocation.dat', 'Geolocation.pm']);
const prunedModules = new Set([...nativeFormats, ...unsupportedFormats, ...unusedResources]
  .filter((name) => name.endsWith('.pm')).map((name) => name.slice(0, -3)));

function stripDocumentation(source, name) {
  let text = source.toString('latin1').replace(
    /^=\w+[^\n]*\n[\s\S]*?(?:^=cut[^\n]*(?:\n|$)|(?![\s\S]))/gm,
    '\n',
  );
  if (name === 'TagLookup.pm') {
    
    
    const lookup = '            my $table = GetTagTable( $tableList[$tableNum] );';
    if (text.split(lookup).length !== 2) throw new Error('Unexpected ExifTool TagLookup layout.');
    text = text.replace(/^ +('Image::ExifTool::(\w+)::[^']+'),$/gm,
      (_line, table, module) => prunedModules.has(module) ? "''," : `${table},`);
    text = text.replace(lookup, `            next unless $tableList[$tableNum];\n${lookup}`);
  }
  return Buffer.from(text, 'latin1');
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function optimizeExifTool(upstream) {
  if (sha256(upstream) !== upstreamHash) {
    throw new Error('ZeroPerl layout changed. Re-audit the embedded filesystem before updating the upstream hash.');
  }

  const wasm = Buffer.from(upstream);
  const offset = (address) => dataOffset + address - dataAddress;
  let originalSize = 0;
  let trimmedSize = 0;
  const pruned = [];
  for (let i = 0; i < fileCount; i += 1) {
    
    const record = fileTable + i * 12;
    const pathOffset = offset(wasm.readUInt32LE(record));
    const path = wasm.toString('utf8', pathOffset, wasm.indexOf(0, pathOffset));
    if (!path.startsWith(exiftoolPath)) continue;
    const startAddress = wasm.readUInt32LE(record + 4);
    const start = offset(startAddress);
    const end = offset(wasm.readUInt32LE(record + 8));
    const source = wasm.subarray(start, end);
    const name = path.slice(exiftoolPath.length).replace(/^ExifTool\//, '');
    originalSize += source.length;

    let replacement;
    if (nativeFormats.has(name) || unsupportedFormats.has(name) || unusedResources.has(name)) {
      
      replacement = Buffer.alloc(0);
      pruned.push(name);
    } else if (/\.(pm|pl)$/.test(name)) {
      
      const required = source.toString('latin1').matchAll(/^\s*use Image::ExifTool::(\w+)\b/gm);
      for (const [, module] of required) {
        if (prunedModules.has(module)) throw new Error(`${name} imports pruned module ${module}.`);
      }
      replacement = stripDocumentation(source, name);
    } else {
      continue;
    }
    if (replacement.length > source.length) throw new Error(`VFS entry grew: ${name}`);
    if (replacement.equals(source)) continue;
    replacement.copy(wasm, start);
    wasm.fill(0, start + replacement.length, end);
    wasm.writeUInt32LE(startAddress + replacement.length, record + 8);
    trimmedSize += source.length - replacement.length;
  }
  console.log(`ExifTool VFS: ${originalSize} bytes upstream, ${trimmedSize} bytes removed.`);
  console.log(`Pruned: ${pruned.join(', ')}`);

  const directory = mkdtempSync(join(tmpdir(), 'meinsert-wasm-'));
  try {
    const input = join(directory, 'input.wasm');
    const output = join(directory, 'output.wasm');
    writeFileSync(input, wasm);
    execFileSync(process.execPath, [
      fileURLToPath(new URL('../node_modules/binaryen/bin/wasm-opt', import.meta.url)),
      input, '-Oz', '--enable-bulk-memory', '--enable-sign-ext',
      '--enable-nontrapping-float-to-int', '--strip-debug', '-o', output,
    ], { stdio: 'inherit' });
    const optimized = readFileSync(output);
    if (!WebAssembly.validate(optimized)) throw new Error('Optimized ZeroPerl is invalid.');
    return optimized;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
