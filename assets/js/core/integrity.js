/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { normalizeCustomKey, normalizeFieldValue, normalizeRawTag, normalizeText } from './metadata-snapshot.js';
import {
  isCoverRaw,
  isGeneratedRaw,
  isIgnoredRaw,
  isVolatileRaw,
  knownLossFor,
  nativeTagsForField,
  rulesFor,
  xmpTagsForField,
} from './integrity-rules.js';
function emptyNormalized(value) {
  return !value || value === '[]';
}
function coversMatch(expected, actual) {
  if (!expected?.present && !actual?.present) return true;
  if (Boolean(expected?.present) !== Boolean(actual?.present)) return false;
  if (!expected.present) return true;
  if (expected.hash && actual?.hash) return expected.hash === actual.hash;
  return expected.mime === actual?.mime
    && Number(expected.size || 0) === Number(actual?.size || 0)
    && (!expected.kind || !actual?.kind || expected.kind === actual.kind);
}
function structureMismatch(before, after) {
  const checks = [
    ['pages', 'Halaman PDF berubah.'],
    ['width', 'Lebar media berubah.'],
    ['height', 'Tinggi media berubah.'],
    ['trackCount', 'Jumlah track berubah.'],
    ['videoCodec', 'Codec video berubah.'],
    ['audioCodec', 'Codec audio berubah.'],
    ['sampleRate', 'Sample rate berubah.'],
    ['channels', 'Jumlah channel berubah.'],
    ['chapterCount', 'Jumlah chapter berubah.'],
  ];
  const findings = [];
  for (const [key, message] of checks) {
    const expected = before?.[key];
    const actual = after?.[key];
    if (expected === undefined || expected === null || expected === '') continue;
    if (actual === undefined || actual === null || actual === '') {
      findings.push({ severity: 'error', code: 'STRUCTURE_LOST', target: key, message, before: expected, after: actual });
      continue;
    }
    if (Number.isFinite(Number(expected)) && Number.isFinite(Number(actual))) {
      if (Number(expected) !== Number(actual)) {
        findings.push({ severity: 'error', code: 'STRUCTURE_CHANGED', target: key, message, before: expected, after: actual });
      }
    } else if (String(expected) !== String(actual)) {
      findings.push({ severity: 'error', code: 'STRUCTURE_CHANGED', target: key, message, before: expected, after: actual });
    }
  }
  const durationBefore = Number(before?.duration);
  const durationAfter = Number(after?.duration);
  if (Number.isFinite(durationBefore) && durationBefore > 0 && Number.isFinite(durationAfter) && durationAfter > 0) {
    const tolerance = Math.max(0.05, durationBefore * 0.0005);
    if (Math.abs(durationBefore - durationAfter) > tolerance) {
      findings.push({
        severity: 'error',
        code: 'STRUCTURE_CHANGED',
        target: 'duration',
        message: 'Durasi media berubah.',
        before: durationBefore,
        after: durationAfter,
      });
    }
  }
  return findings;
}
function expectedRawTags(plan) {
  const tags = new Set();
  for (const op of plan?.operations || []) {
    if (op.kind === 'raw') tags.add(normalizeRawTag(op.tag));
    if (op.kind === 'cover') {
      continue;
    }
    if (op.kind === 'custom') {
      const key = normalizeRawTag(op.key);
      tags.add(key);
      tags.add(`txxx:${key}`);
      continue;
    }
    if (op.kind !== 'field') continue;
    tags.add(normalizeRawTag(op.id));
    const field = plan?.before?.fields?.[op.id];
    for (const tag of nativeTagsForField(field)) tags.add(normalizeRawTag(tag));
  }
  return tags;
}
function expectedXmpTags(plan) {
  const tags = new Set();
  for (const op of plan?.operations || []) {
    if (op.kind !== 'field') continue;
    for (const tag of xmpTagsForField(plan?.before?.fields?.[op.id] || { id: op.id })) {
      tags.add(tag);
    }
  }
  return tags;
}

function makeSummary(plan) {
  return {
    checked: 0,
    expected: plan?.operations?.length || 0,
    preserved: 0,
    lost: 0,
    changed: 0,
    added: 0,
    unverified: 0,
    knownLoss: 0,
  };
}
export function verifyIntegrity(plan, afterSnapshot) {
  const findings = [];
  const knownLoss = [];
  const summary = makeSummary(plan);
  const before = plan?.before || {};
  const after = afterSnapshot;
  const rules = rulesFor(plan?.format?.id || before.format?.id);
  const targets = expectedRawTags(plan);
  const add = (finding) => {
    findings.push(finding);
    if (finding.code === 'METADATA_LOST' || finding.code === 'FIELD_LOST' || finding.code === 'CUSTOM_LOST') {
      summary.lost += 1;
    } else if (finding.code === 'METADATA_ADDED' || finding.code === 'FIELD_ADDED') {
      summary.added += 1;
    } else if (finding.severity === 'error') {
      summary.changed += 1;
    }
  };
  if (!after) {
    return {
      status: 'unverified',
      summary: { ...summary, unverified: 1 },
      findings: [{
        severity: 'warning',
        code: 'VERIFY_UNAVAILABLE',
        target: 'metadata',
        message: 'Hasil penulisan tidak bisa dibaca ulang, jadi integritas metadata belum bisa dipastikan.',
        before: '',
        after: '',
      }],
      knownLoss: [],
    };
  }
  const afterFields = after.fields || {};
  const targetFieldIds = new Set();
  for (const op of plan?.operations || []) {
    if (op.kind !== 'field') continue;
    targetFieldIds.add(op.id);
    const actual = afterFields[op.id];
    const actualNormalized = actual?.normalized || '';
    const field = before.fields?.[op.id];
    if (op.action === 'set') {
      const expected = op.afterNormalized ?? normalizeFieldValue(field, op.after);
      summary.checked += 1;
      if (actualNormalized !== expected) {
        add({
          severity: 'error',
          code: 'REQUEST_NOT_APPLIED',
          target: `field:${op.id}`,
          message: `Field "${op.label}" tidak tersimpan sesuai permintaan.`,
          before: op.before,
          after: actual?.value || '',
        });
      }
    } else if (op.action === 'remove') {
      summary.checked += 1;
      if (!emptyNormalized(actualNormalized)) {
        add({
          severity: 'error',
          code: 'REQUEST_NOT_REMOVED',
          target: `field:${op.id}`,
          message: `Field "${op.label}" belum terhapus.`,
          before: op.before,
          after: actual?.value || '',
        });
      }
    }
  }
  for (const [id, field] of Object.entries(before.fields || {})) {
    if (targetFieldIds.has(id)) continue;
    const actual = afterFields[id];
    const beforeNormalized = field.normalized || '';
    const afterNormalized = actual?.normalized || '';
    summary.checked += 1;
    if (!beforeNormalized && !afterNormalized) {
      summary.preserved += 1;
      continue;
    }
    if (beforeNormalized && !afterNormalized) {
      add({
        severity: 'error',
        code: 'FIELD_LOST',
        target: `field:${id}`,
        message: `Field "${field.label}" hilang padahal tidak diubah.`,
        before: field.value,
        after: '',
      });
      continue;
    }
    if (beforeNormalized !== afterNormalized) {
      add({
        severity: 'error',
        code: 'FIELD_CHANGED_UNEXPECTED',
        target: `field:${id}`,
        message: `Field "${field.label}" berubah padahal tidak diubah.`,
        before: field.value,
        after: actual?.value || '',
      });
      continue;
    }
    summary.preserved += 1;
  }
  const beforeCustom = new Map((before.custom || []).map((row) => [row.canonicalKey, row]));
  const afterCustom = new Map((after.custom || []).map((row) => [row.canonicalKey, row]));
  const targetCustomKeys = new Set();
  for (const op of plan?.operations || []) {
    if (op.kind !== 'custom') continue;
    const key = normalizeCustomKey(plan?.format?.id, op.key);
    targetCustomKeys.add(key);
    const actual = afterCustom.get(key);
    summary.checked += 1;
    if (op.action === 'remove') {
      if (actual?.value) {
        add({
          severity: 'error',
          code: 'REQUEST_NOT_REMOVED',
          target: `custom:${op.key}`,
          message: `Tag kustom "${op.key}" belum terhapus.`,
          before: op.before,
          after: actual.value,
        });
      }
      continue;
    }
    if (!actual || actual.value !== (op.afterNormalized ?? normalizeText(op.after))) {
      add({
        severity: 'error',
        code: 'REQUEST_NOT_APPLIED',
        target: `custom:${op.key}`,
        message: `Tag kustom "${op.key}" tidak tersimpan sesuai permintaan.`,
        before: op.before,
        after: actual?.value || '',
      });
    }
  }
  for (const [key, row] of beforeCustom) {
    if (targetCustomKeys.has(key)) continue;
    summary.checked += 1;
    const actual = afterCustom.get(key);
    if (!actual) {
      add({
        severity: 'error',
        code: 'CUSTOM_LOST',
        target: `custom:${row.key}`,
        message: `Tag kustom "${row.key}" hilang padahal tidak diubah.`,
        before: row.value,
        after: '',
      });
    } else if (actual.value !== row.value) {
      add({
        severity: 'error',
        code: 'CUSTOM_CHANGED_UNEXPECTED',
        target: `custom:${row.key}`,
        message: `Tag kustom "${row.key}" berubah padahal tidak diubah.`,
        before: row.value,
        after: actual.value,
      });
    } else {
      summary.preserved += 1;
    }
  }
  const beforeRaw = new Map((before.raw || []).map((row) => [row.canonicalTag, row]));
  const afterRaw = new Map((after.raw || []).map((row) => [row.canonicalTag, row]));
  const targetRaw = new Set((plan?.operations || []).filter((op) => op.kind === 'raw').map((op) => normalizeRawTag(op.tag)));
  const addKnown = (message, code, target, beforeValue, afterValue) => {
    const entry = { code, message, target };
    if (!knownLoss.some((item) => item.code === code && item.target === target)) {
      knownLoss.push(entry);
      summary.knownLoss += 1;
    }
    findings.push({
      severity: 'warning',
      code,
      target,
      message,
      before: beforeValue ?? '',
      after: afterValue ?? '',
    });
  };
  for (const [tag, row] of beforeRaw) {
    if (targetRaw.has(tag) || targets.has(tag)) {
      summary.checked += 1;
      continue;
    }
    if (isCoverRaw(row, rules) || isIgnoredRaw(row, rules) || isVolatileRaw(row, rules)) continue;
    summary.checked += 1;
    const actual = afterRaw.get(tag);
    const loss = knownLossFor(row, rules);
    if (!actual) {
      if (loss) {
        addKnown(loss.message, loss.code, `raw:${row.tag}`, row.value, '');
      } else {
        add({
          severity: 'error',
          code: 'METADATA_LOST',
          target: `raw:${row.tag}`,
          message: `Tag "${row.tag}" hilang padahal tidak dihapus.`,
          before: row.value,
          after: '',
        });
      }
      continue;
    }
    if (actual.value !== row.value) {
      if (loss) {
        addKnown(loss.message, loss.code, `raw:${row.tag}`, row.value, actual.value);
      } else {
        add({
          severity: 'error',
          code: 'METADATA_CHANGED_UNEXPECTED',
          target: `raw:${row.tag}`,
          message: `Tag "${row.tag}" berubah padahal tidak diubah.`,
          before: row.value,
          after: actual.value,
        });
      }
      continue;
    }
    summary.preserved += 1;
  }
  for (const [tag, row] of afterRaw) {
    if (beforeRaw.has(tag) || targetRaw.has(tag) || targets.has(tag)) continue;
    if (isCoverRaw(row, rules) || isIgnoredRaw(row, rules) || isVolatileRaw(row, rules) || isGeneratedRaw(row, rules)) continue;
    summary.checked += 1;
    add({
      severity: 'warning',
      code: 'METADATA_ADDED',
      target: `raw:${row.tag}`,
      message: `Tag baru "${row.tag}" muncul setelah penulisan.`,
      before: '',
      after: row.value,
    });
  }
  for (const op of plan?.operations || []) {
    if (op.kind !== 'raw') continue;
    summary.checked += 1;
    if (afterRaw.has(normalizeRawTag(op.tag))) {
      add({
        severity: 'error',
        code: 'REQUEST_NOT_REMOVED',
        target: `raw:${op.tag}`,
        message: `Tag "${op.tag}" belum terhapus.`,
        before: op.before,
        after: afterRaw.get(normalizeRawTag(op.tag))?.value || '',
      });
    }
  }
  const beforeXmp = before.xmp || { present: false, ok: true, properties: [] };
  const afterXmp = after.xmp || { present: false, ok: true, properties: [] };
  if (beforeXmp.present && beforeXmp.ok === false) {
    summary.unverified += 1;
    add({
      severity: 'warning',
      code: 'XMP_UNVERIFIED',
      target: 'xmp',
      message: 'XMP lama tidak bisa diinventarisasi dengan aman, jadi properti XMP tidak bisa dibandingkan.',
      before: beforeXmp.error || '',
      after: '',
    });
  } else if (afterXmp.present && afterXmp.ok === false) {
    summary.unverified += 1;
    add({
      severity: 'warning',
      code: 'XMP_UNVERIFIED',
      target: 'xmp',
      message: 'XMP hasil tidak bisa diinventarisasi dengan aman, jadi properti XMP belum bisa dipastikan.',
      before: '',
      after: afterXmp.error || '',
    });
  } else {
    const targetXmp = expectedXmpTags(plan);
    const beforeXmpMap = new Map((beforeXmp.properties || []).map((row) => [row.canonicalTag, row]));
    const afterXmpMap = new Map((afterXmp.properties || []).map((row) => [row.canonicalTag, row]));
    for (const [tag, row] of beforeXmpMap) {
      summary.checked += 1;
      if (targetXmp.has(tag)) continue;
      const actual = afterXmpMap.get(tag);
      if (!actual) {
        add({
          severity: 'error',
          code: 'XMP_LOST',
          target: `xmp:${row.qualified}`,
          message: `Properti XMP "${row.qualified}" hilang padahal tidak diubah.`,
          before: row.value,
          after: '',
        });
        continue;
      }
      if (actual.value !== row.value) {
        add({
          severity: 'error',
          code: 'XMP_CHANGED_UNEXPECTED',
          target: `xmp:${row.qualified}`,
          message: `Properti XMP "${row.qualified}" berubah padahal tidak diubah.`,
          before: row.value,
          after: actual.value,
        });
        continue;
      }
      summary.preserved += 1;
    }
    for (const [tag, row] of afterXmpMap) {
      if (beforeXmpMap.has(tag) || targetXmp.has(tag)) continue;
      summary.checked += 1;
      add({
        severity: 'warning',
        code: 'XMP_ADDED',
        target: `xmp:${row.qualified}`,
        message: `Properti XMP baru "${row.qualified}" muncul setelah penulisan.`,
        before: '',
        after: row.value,
      });
    }
  }

  summary.checked += 1;
  if (!coversMatch(before.cover, after.cover)) {
    const coverOp = (plan?.operations || []).find((op) => op.kind === 'cover');
    if (coverOp) {
      if (coverOp.action === 'remove' && after.cover?.present) {
        add({
          severity: 'error',
          code: 'REQUEST_NOT_REMOVED',
          target: 'cover',
          message: 'Sampul belum terhapus.',
          before: coverOp.before,
          after: coverOp.after,
        });
      } else if (coverOp.action !== 'remove' && !coversMatch(coverOp.afterCover, after.cover)) {
        add({
          severity: 'error',
          code: 'REQUEST_NOT_APPLIED',
          target: 'cover',
          message: 'Sampul tidak tersimpan sesuai permintaan.',
          before: coverOp.before,
          after: coverOp.after,
        });
      }
    } else {
      add({
        severity: 'error',
        code: 'COVER_CHANGED_UNEXPECTED',
        target: 'cover',
        message: 'Sampul berubah padahal tidak diubah.',
        before: before.cover?.mime || '',
        after: after.cover?.mime || '',
      });
    }
  } else {
    summary.preserved += 1;
  }
  for (const finding of structureMismatch(before.structure, after.structure)) {
    summary.checked += 1;
    add(finding);
  }
  if (before.structure?.signed && after.structure?.signed === false) {
    addKnown(
      'Tanda tangan digital PDF tidak lagi valid setelah metadata ditulis.',
      'SIGNATURE_INVALIDATED',
      'structure:signed',
      'signed',
      'unsigned',
    );
  }
  const hasError = findings.some((finding) => finding.severity === 'error');
  return {
    status: hasError ? 'failed' : (findings.length ? 'warning' : 'ok'),
    summary,
    findings,
    knownLoss,
  };
}
