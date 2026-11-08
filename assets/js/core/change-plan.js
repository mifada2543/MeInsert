/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { createSnapshot, hashBytes, normalizeCustomKey, normalizeFieldValue, normalizeRawTag, normalizeText } from './metadata-snapshot.js';
import { isCoverRaw, rulesFor } from './integrity-rules.js';

function fieldsFor(adapter, detection) {
  if (!adapter) return [];
  if (typeof adapter.fieldsFor === 'function') return adapter.fieldsFor(detection?.subtype) || [];
  return adapter.fields || [];
}
function coverHash(cover) {
  if (!cover?.data) return null;
  return hashBytes(cover.data);
}
function coverSame(before, after) {
  if (Boolean(before) !== Boolean(after)) return false;
  if (!before || !after) return true;
  if (before.hash && after.hash) return before.hash === after.hash;
  return before.mime === after.mime && before.size === after.size && before.kind === after.kind;
}
function sameCoverOperation(beforeCover, payloadCover) {
  if (!payloadCover) return true;
  if (payloadCover.action === 'remove') return !beforeCover.present;
  if (payloadCover.action !== 'set' || !payloadCover.data) return true;
  const after = {
    hash: coverHash(payloadCover),
    mime: normalizeText(payloadCover.mimeType),
    size: Number(payloadCover.data.byteLength || payloadCover.data.length) || 0,
    kind: normalizeText(payloadCover.kind || 'coverFront'),
  };
  return coverSame(beforeCover, after);
}
export function buildChangePlan({
  adapter,
  detection,
  baseline,
  payload = {},
  outputName = '',
  source = 'single',
  sources = {},
  memory = null,
} = {}) {
  const before = baseline || createSnapshot({ adapter, detection, readResult: { fields: {}, raw: [], custom: [], info: {} } });
  const formatId = adapter?.meta?.id || detection?.id || before.format?.id || 'unknown';
  const rules = rulesFor(formatId);
  const definitions = fieldsFor(adapter, detection);
  const byId = new Map(definitions.map((field) => [field.id, field]));
  const operations = [];
  const noops = [];
  const actualSet = {};
  const actualRemove = new Set();
  const actualCustom = [];
  const actualCustomRemove = new Set();
  const actualRawRemove = new Set();
  let actualCover = null;
  const targetFields = new Set();
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);
  for (const field of definitions) {
    const beforeField = before.fields?.[field.id];
    const beforeValue = beforeField?.normalized || '';
    const beforeDisplay = beforeField?.value || '';
    if (remove.has(field.id)) {
      targetFields.add(field.id);
      if (!beforeValue) {
        noops.push({ kind: 'field', action: 'remove', id: field.id, label: field.label });
        continue;
      }
      actualRemove.add(field.id);
      operations.push({
        kind: 'field',
        action: 'remove',
        id: field.id,
        label: field.label || field.id,
        native: field.native || '',
        before: beforeDisplay,
        beforeNormalized: beforeValue,
        after: '',
        afterNormalized: '',
        source: sources[field.id] || source,
      });
    } else if (field.id in set) {
      targetFields.add(field.id);
      const afterValue = normalizeFieldValue(field, set[field.id]);
      if (afterValue === beforeValue) {
        noops.push({ kind: 'field', action: 'set', id: field.id, label: field.label });
        continue;
      }
      actualSet[field.id] = set[field.id];
      operations.push({
        kind: 'field',
        action: 'set',
        id: field.id,
        label: field.label || field.id,
        native: field.native || '',
        before: beforeDisplay,
        beforeNormalized: beforeValue,
        after: field.type === 'tags' ? (Array.isArray(set[field.id]) ? set[field.id].join(', ') : normalizeText(set[field.id])) : normalizeText(set[field.id]),
        afterNormalized: afterValue,
        source: sources[field.id] || source,
      });
    }
  }
  for (const id of Object.keys(set)) {
    if (byId.has(id)) continue;
    const afterValue = normalizeText(set[id]);
    if (!afterValue) continue;
    actualSet[id] = set[id];
    operations.push({
      kind: 'field',
      action: 'set',
      id,
      label: id,
      native: '',
      before: '',
      beforeNormalized: '',
      after: afterValue,
      afterNormalized: afterValue,
      source: sources[id] || source,
    });
  }
  for (const id of remove) {
    if (byId.has(id)) continue;
    actualRemove.add(id);
    operations.push({
      kind: 'field',
      action: 'remove',
      id,
      label: id,
      native: '',
      before: '',
      beforeNormalized: '',
      after: '',
      afterNormalized: '',
      source: sources[id] || source,
    });
  }
  const beforeCustom = new Map((before.custom || []).map((row) => [row.canonicalKey, row]));
  const customKeys = new Set();
  const customPayload = payload?.custom || [];
  for (const item of customPayload) {
    const key = normalizeText(item?.key);
    if (!key) continue;
    const canonicalKey = normalizeCustomKey(formatId, key);
    const beforeRow = beforeCustom.get(canonicalKey);
    const afterValue = normalizeText(item?.value);
    customKeys.add(canonicalKey);
    if (beforeRow && beforeRow.value === afterValue) {
      noops.push({ kind: 'custom', action: 'set', key });
      continue;
    }
    actualCustom.push({ key, value: afterValue });
    operations.push({
      kind: 'custom',
      action: beforeRow ? 'set' : 'add',
      key,
      label: key,
      before: beforeRow?.value || '',
      beforeNormalized: beforeRow?.value || '',
      after: afterValue,
      afterNormalized: afterValue,
      source: sources[`custom:${canonicalKey}`] || source,
    });
  }
  for (const item of payload?.customRemove || []) {
    const key = normalizeText(item);
    if (!key) continue;
    const canonicalKey = normalizeCustomKey(formatId, key);
    if (customKeys.has(canonicalKey)) continue;
    const beforeRow = beforeCustom.get(canonicalKey);
    if (!beforeRow) {
      noops.push({ kind: 'custom', action: 'remove', key });
      continue;
    }
    actualCustomRemove.add(key);
    operations.push({
      kind: 'custom',
      action: 'remove',
      key,
      label: key,
      before: beforeRow.value,
      beforeNormalized: beforeRow.value,
      after: '',
      afterNormalized: '',
      source: sources[`custom:${canonicalKey}`] || source,
    });
  }
  const rawBefore = new Map((before.raw || []).map((row) => [row.canonicalTag, row]));
  for (const item of payload?.rawRemove || []) {
    const tag = normalizeText(item);
    if (!tag) continue;
    const row = rawBefore.get(normalizeRawTag(tag));
    if (!row) {
      noops.push({ kind: 'raw', action: 'remove', tag });
      continue;
    }
    actualRawRemove.add(tag);
    operations.push({
      kind: 'raw',
      action: 'remove',
      tag: row.tag,
      group: row.group,
      label: row.tag,
      before: row.value,
      beforeNormalized: row.value,
      after: '',
      afterNormalized: '',
      source: sources[`raw:${normalizeRawTag(tag)}`] || source,
    });
  }
  if (payload?.cover?.action === 'set' || payload?.cover?.action === 'remove') {
    if (sameCoverOperation(before.cover, payload.cover)) {
      noops.push({ kind: 'cover', action: payload.cover.action });
    } else {
      actualCover = payload.cover;
      const after = payload.cover.action === 'remove'
        ? { present: false, mime: '', size: 0, kind: '', hash: null }
        : {
          present: true,
          mime: normalizeText(payload.cover.mimeType),
          size: Number(payload.cover.data?.byteLength || payload.cover.data?.length) || 0,
          kind: normalizeText(payload.cover.kind || 'coverFront'),
          hash: coverHash(payload.cover),
          name: payload.cover.name || '',
        };
      operations.push({
        kind: 'cover',
        action: before.cover.present ? (payload.cover.action === 'remove' ? 'remove' : 'replace') : 'add',
        label: 'Sampul',
        before: before.cover.present ? `${before.cover.mime || 'gambar'} · ${before.cover.size} byte` : '',
        after: after.present ? `${after.mime || 'gambar'} · ${after.size} byte${after.name ? ` · ${after.name}` : ''}` : '',
        beforeCover: before.cover,
        afterCover: after,
      });
    }
  }
  const changedFields = new Set(operations.filter((op) => op.kind === 'field').map((op) => op.id));
  const changedCustom = new Set(operations.filter((op) => op.kind === 'custom').map((op) => normalizeCustomKey(formatId, op.key)));
  const changedRaw = new Set(operations.filter((op) => op.kind === 'raw').map((op) => normalizeRawTag(op.tag)));
  const unchanged = {
    fields: Object.values(before.fields || {}).filter((field) => field.normalized && !changedFields.has(field.id)).length,
    custom: (before.custom || []).filter((row) => !changedCustom.has(row.canonicalKey)).length,
    raw: (before.raw || []).filter((row) => {
      if (changedRaw.has(row.canonicalTag)) return false;
      if (isCoverRaw(row, rules)) return false;
      return true;
    }).length,
    cover: before.cover?.present && !actualCover ? 1 : 0,
  };
  const risks = [];
  for (const warning of before.warnings || []) {
    risks.push({ code: 'ADAPTER_WARNING', severity: 'warning', message: warning });
  }
  if (before.structure?.signed) {
    risks.push({
      code: 'SIGNED_PDF',
      severity: 'danger',
      message: 'PDF ini memiliki tanda tangan digital. Menulis metadata akan membuat tanda tangan tidak valid.',
    });
  }
  if (formatId === 'mkv') {
    risks.push({
      code: 'MKV_REWRITE',
      severity: 'warning',
      message: 'Container MKV/WebM ditulis ulang; chapter dan attachment mungkin tidak dipertahankan.',
    });
  }
  const coverRisk = operations.find((op) => op.kind === 'cover' && op.action === 'remove');
  if (coverRisk && before.cover.present) {
    risks.push({
      code: 'COVER_REMOVED',
      severity: 'warning',
      message: 'Sampul akan dihapus dari file hasil.',
    });
  }
  if (memory?.level === 'warn' || memory?.level === 'block') {
    risks.push({
      code: memory.level === 'block' ? 'MEMORY_BLOCK' : 'MEMORY_WARN',
      severity: memory.level === 'block' ? 'danger' : 'warning',
      message: memory.message || 'Perkiraan penggunaan memori tinggi.',
    });
  }
  return {
    id: `${formatId}:${outputName || 'output'}`,
    format: before.format,
    fileName: '',
    outputName,
    before,
    payload: {
      set: actualSet,
      remove: [...actualRemove],
      custom: actualCustom,
      customRemove: [...actualCustomRemove],
      rawRemove: [...actualRawRemove],
      ...(actualCover ? { cover: actualCover } : {}),
    },
    operations,
    noops,
    unchanged,
    risks,
    memory: memory || null,
    hasOperations: operations.length > 0,
  };
}
export function planSummary(plan) {
  return {
    operations: plan?.operations?.length || 0,
    fields: plan?.operations?.filter((op) => op.kind === 'field').length || 0,
    custom: plan?.operations?.filter((op) => op.kind === 'custom').length || 0,
    raw: plan?.operations?.filter((op) => op.kind === 'raw').length || 0,
    cover: plan?.operations?.filter((op) => op.kind === 'cover').length || 0,
    unchanged: plan?.unchanged || { fields: 0, custom: 0, raw: 0, cover: 0 },
  };
}
