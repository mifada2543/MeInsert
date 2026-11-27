/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asArray, asString } from '../core/tag-utils.js';

export async function replaceBatchText(values, { query, replacement, regex, caseSensitive }) {
  if (!query || query.length > 128 || replacement.length > 512 || values.length > 50
    || values.some((value) => value.length > 10000)) throw new Error('Invalid batch replacement');
  if (!regex) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, caseSensitive ? 'gu' : 'giu');
    return values.map((value) => {
      const result = value.replace(pattern, () => replacement);
      if (result.length > 10000) throw new Error('Replacement too long');
      return result;
    });
  }
  const worker = new Worker(new URL('../workers/batch-regex.worker.js', import.meta.url), { type: 'module' });
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      const fail = () => reject(new Error('Regex failed or timed out'));
      timer = setTimeout(fail, 500);
      worker.onmessage = ({ data }) => data.invalid ? fail() : resolve(data.values);
      worker.onerror = fail;
      worker.postMessage({ values, query, replacement, caseSensitive });
    });
  } finally {
    clearTimeout(timer);
    worker.terminate();
  }
}

export function nextTrackPatch(fields, number, digits, total) {
  if (!Number.isInteger(number) || number < 1 || number > 9999 || (total && total < number)) return {};
  const track = fields.find((field) => field.id === 'trackNumber' || field.id === 'track');
  if (!track) return {};
  const text = String(number).padStart(digits, '0');
  if (track.id === 'track') return { track: total ? `${text}/${total}` : text };
  return { trackNumber: String(number), ...(total && fields.some((field) => field.id === 'trackTotal')
    ? { trackTotal: String(total) } : {}) };
}

export function effectiveValue(controller, item, id) {
  const { set, remove } = controller.collectGroupPayload(item).payload;
  return remove.includes(id) ? '' : asString(set[id] ?? item.readResult?.fields?.[id]);
}

export function transformedValue(field, value) {
  if (!value.trim()) return null;
  return field.type === 'tags' ? asArray(value) : value;
}
