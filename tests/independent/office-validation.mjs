/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from '../../assets/vendor/fflate.mjs';
import { getAdapter } from '../../assets/js/core/registry.js';
import { detectFile } from '../../assets/js/core/detector.js';
import { parseXml } from '../../assets/js/core/office-xml.js';
const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtures = join(root, 'tests', 'fixtures');
const names = [
  'sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.docm', 'sample.xlsm', 'sample.pptm',
  'sample.odt', 'sample.ods', 'sample.odp',
];
const work = mkdtempSync(join(tmpdir(), 'meinsert-office-'));
const artifacts = join(work, 'artifacts');
const xmlDir = join(work, 'xml');
const loInput = join(work, 'lo-in');
const loOutput = join(work, 'lo-out');
for (const dir of [artifacts, xmlDir, loInput, loOutput]) mkdirSync(dir, { recursive: true });
let failures = 0;
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`); };
const hasBinary = (name) => spawnSync(name, ['--version'], { stdio: 'ignore', timeout: 15_000 }).status === 0;
try {
  for (const name of names) {
    const bytes = readFileSync(join(fixtures, name));
    const file = new File([bytes], name);
    const detection = await detectFile(file);
    const adapter = await getAdapter(detection.id);
    const options = { subtype: detection.subtype, extension: detection.ext, mime: detection.mime };
    const result = await adapter.write(file, {
      set: { title: 'Independent verify', description: 'A & <B> "\u00e9" \u{1f600}' },
      custom: [{ key: 'AuditCode', value: 'P2-2026' }],
    }, options, () => {});
    const unexpected = result.warnings.filter((warning) => !/makro|tanda tangan/i.test(warning));
    if (unexpected.length) fail(`${name}: write warnings: ${unexpected.join(' | ')}`);
    if (result.warnings.length) console.log(`NOTE: ${name}: ${result.warnings.join(' | ')}`);
    writeFileSync(join(artifacts, name), new Uint8Array(await result.blob.arrayBuffer()));
    console.log(`PASS: wrote ${name} (${detection.subtype})`);
  }
  let xmlCount = 0;
  for (const name of names) {
    const parts = unzipSync(new Uint8Array(readFileSync(join(artifacts, name))));
    const target = join(xmlDir, name.replaceAll('.', '_'));
    mkdirSync(target, { recursive: true });
    for (const [partName, data] of Object.entries(parts)) {
      if (!/\.(xml|rels)$/i.test(partName)) continue;
      xmlCount += 1;
      const path = join(target, partName);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, data);
      try {
        parseXml(new TextDecoder().decode(data), partName);
      } catch (error) {
        fail(`${name}:${partName}: namespace-aware parse failed: ${error.message}`);
      }
    }
  }
  console.log(`PASS: namespace-aware parse of ${xmlCount} XML parts`);
  if (hasBinary('xmllint')) {
    let checked = 0;
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(xml|rels)$/i.test(entry.name)) {
          checked += 1;
          const result = spawnSync('xmllint', ['--noout', '-'], {
            input: readFileSync(path), stdio: ['pipe', 'ignore', 'pipe'], timeout: 30_000,
          });
          if (result.status !== 0) fail(`${path}: ${result.stderr.toString().trim()}`);
        }
      }
    };
    walk(xmlDir);
    if (checked) console.log(`PASS: xmllint validated ${checked} XML parts`);
  } else {
    console.log('SKIP: xmllint not installed (namespace-aware parse still executed)');
  }
  if (hasBinary('soffice') || hasBinary('libreoffice')) {
    const binary = hasBinary('soffice') ? 'soffice' : 'libreoffice';
    const inputs = [];
    names.forEach((name, index) => {
      const copy = join(loInput, `case${String(index + 1).padStart(2, '0')}-${name}`);
      writeFileSync(copy, readFileSync(join(artifacts, name)));
      inputs.push(copy);
    });
    const result = spawnSync(binary, [
      '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', loOutput, ...inputs,
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000 });
    const pdfs = readdirSync(loOutput).filter((name) => name.toLowerCase().endsWith('.pdf'));
    if (result.status !== 0 || pdfs.length !== names.length) {
      fail(`LibreOffice produced ${pdfs.length}/${names.length} PDFs (exit ${result.status}): ${result.stderr?.toString().trim() || ''}`);
    } else {
      console.log(`PASS: LibreOffice opened and converted ${pdfs.length}/${names.length} documents`);
    }
  } else {
    console.log('SKIP: LibreOffice not installed');
  }
  console.log(`Independent Office validation finished with ${failures} failure(s).`);
  if (failures) process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}