/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { jobs, concurrency } from '../compat/jobs.mjs';
test('compatibility concurrency is bounded and cannot silently spawn unbounded browsers', () => {
  assert.equal(concurrency(), 2);
  assert.equal(concurrency('1'), 1);
  assert.equal(concurrency(8), 8);
  for (const value of ['0', '-1', '9', '1.5', '2x', '', 'Infinity', null]) assert.throws(() => concurrency(value));
});
test('isolated format jobs cover every original fixture once and keep cover/UI work owned', () => {
  assert.equal(new Set(jobs.map((job) => job.id)).size, jobs.length);
  const fixtures = jobs.flatMap((job) => job.fixtures);
  assert.equal(new Set(fixtures).size, fixtures.length);
  assert.equal(fixtures.length, 27); // 18 original + 9 Office fixtures
  for (const job of jobs) for (const name of job.covers || []) assert.ok(job.fixtures.includes(name));
  assert.deepEqual(jobs.filter((job) => job.locale).map((job) => job.locale), ['id-ID', 'en-US']);
  assert.equal(jobs.filter((job) => job.mp4Policy).length, 1);
});