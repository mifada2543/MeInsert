/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
function collect(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const group = String(row.group || '');
    const tag = String(row.tag || '');
    if (!tag) continue;
    const key = JSON.stringify([group, tag]);
    if (!counts.has(key)) counts.set(key, { group, tag, values: new Map() });
    const values = counts.get(key).values;
    const value = String(row.value ?? '');
    values.set(value, (values.get(value) || 0) + 1);
  }
  return counts;
}

export function rawSnapshotDiff(before, after) {
  if (!before || !after) return null;
  const prev = collect(before);
  const next = collect(after);
  const diff = [];
  for (const key of new Set([...prev.keys(), ...next.keys()])) {
    const original = prev.get(key);
    const updated = next.get(key);
    const { group, tag } = original || updated;
    const oldValues = original?.values || new Map();
    const newValues = updated?.values || new Map();
    const removed = [];
    const added = [];
    const add = (status, previous, current) => diff.push({ group, tag, status, before: previous, after: current });
    for (const value of new Set([...oldValues.keys(), ...newValues.keys()])) {
      const left = oldValues.get(value) || 0;
      const right = newValues.get(value) || 0;
      for (let i = 0; i < Math.min(left, right); i += 1) add('unchanged', value, value);
      for (let i = right; i < left; i += 1) removed.push(value);
      for (let i = left; i < right; i += 1) added.push(value);
    }
    for (let i = 0; i < Math.max(removed.length, added.length); i += 1) {
      add(i >= removed.length ? 'added' : i >= added.length ? 'removed' : 'modified',
        removed[i] ?? null, added[i] ?? null);
    }
  }
  return diff;
}
