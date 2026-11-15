/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { jobs, concurrency } from './jobs.mjs';

const args = process.argv.slice(2);
let parallel = concurrency(process.env.COMPAT_CONCURRENCY || Math.min(2, availableParallelism()));
let formats;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--concurrency') parallel = concurrency(args[++index]);
  else if (args[index] === '--format') formats = args[++index]?.split(',');
  else throw new Error(`Unknown option: ${args[index]}`);
}
if (formats && (!formats.length || formats.some((id) => !jobs.some((job) => job.id === id)))) {
  throw new Error(`Unknown format. Available: ${jobs.map((job) => job.id).join(', ')}`);
}
const selected = jobs.filter((job) => !formats || formats.includes(job.id));
const results = new Map(), children = new Set();
const started = performance.now();
let cursor = 0;
console.log(`Compatibility: ${selected.length} isolated format jobs, concurrency ${parallel} (local assets, no external network).`);
function launch(job) {
  return new Promise((resolve) => {
    const child = fork(new URL('./worker.mjs', import.meta.url), [job.id], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    children.add(child);
    let result, infrastructureError;
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => {
      for (const line of String(data).trimEnd().split('\n')) console.log(`[${job.id}] ${line}`);
    });
    child.on('message', (message) => { result = message; });
    child.on('error', (error) => { infrastructureError = error.message; });
    let killTimer;
    const timer = setTimeout(() => {
      infrastructureError = 'Format job exceeded 10 minutes'; child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, 600000);
    child.on('close', (code, signal) => {
      clearTimeout(timer); clearTimeout(killTimer); children.delete(child);
      if (!result || code !== 0 || infrastructureError) result = { id: job.id, rows: [{ fixture: `${job.id}: worker`, invariants: 'FAIL',
        error: infrastructureError || `Worker exited ${code ?? signal} without a valid result` }] };
      results.set(job.id, result);
      console.log(`[${job.id}] finished: ${result.rows.filter((row) => row.invariants === 'ok').length}/${result.rows.length} (${result.elapsedMs ?? '?'} ms)`);
      resolve();
    });
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  cursor = selected.length;
});
await Promise.all(Array.from({ length: Math.min(parallel, selected.length) }, async () => {
  while (cursor < selected.length) await launch(selected[cursor++]);
}));
const rows = selected.flatMap((job) => results.get(job.id)?.rows || []);
console.table(selected.map((job) => {
  const result = results.get(job.id);
  return { job: job.id, ms: result?.elapsedMs, requests: result?.localRequests,
    localhostMiB: result?.localBytes == null ? '-' : (result.localBytes / 1048576).toFixed(2), nodePeakMiB: result ? (result.peakNodeRssKb / 1024).toFixed(1) : '-' };
}));
console.table(rows.map(({ fixture, format = '-', read = '-', write = '-', reread = '-', invariants, signatureValidity = '-' }) =>
  ({ fixture, format, read, write, reread, invariants, signatureValidity })));
for (const row of rows) {
  if (row.error || row.notes) console.log(`${row.fixture}: ${row.error || row.notes}`);
  if (row.coverBytes || row.signatureContents) console.log(`${row.fixture}: ${JSON.stringify({ coverBytes: row.coverBytes,
    signatureContents: row.signatureContents, signedRanges: row.signedRanges, signatureValidity: row.signatureValidity })}`);
}
const failures = rows.filter((row) => row.invariants !== 'ok');
console.log(`${rows.length - failures.length}/${rows.length} compatibility cases passed; ${Math.round(performance.now() - started)} ms wall time.`);
if (failures.length || results.size !== selected.length) process.exitCode = 1;
