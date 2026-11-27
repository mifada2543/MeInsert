/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
const maxLength = 10000;
const token = /\$([$&`']|\d{1,2}|<[^>]+>)/g;

function substitute(template, match, value) {
  return template.replace(token, (literal, key) => {
    if (key === '$') return '$';
    if (key === '&') return match[0];
    if (key === '`') return value.slice(0, match.index);
    if (key === "'") return value.slice(match.index + match[0].length);
    if (key.startsWith('<')) {
      return match.groups ? match.groups[key.slice(1, -1)] ?? '' : literal;
    }
    const index = Number(key);
    if (index > 0 && index < match.length) return match[index] ?? '';
    const first = Number(key[0]);
    return key.length === 2 && first > 0 && first < match.length ? (match[first] ?? '') + key[1] : literal;
  });
}

function replaceBounded(value, pattern, template) {
  const parts = [];
  let cursor = 0;
  let length = 0;
  for (const match of value.matchAll(pattern)) {
    const text = substitute(template, match, value);
    length += match.index - cursor + text.length;
    if (length > maxLength) throw new Error('Replacement too long');
    parts.push(value.slice(cursor, match.index), text);
    cursor = match.index + match[0].length;
  }
  if (length + value.length - cursor > maxLength) throw new Error('Replacement too long');
  return parts.join('') + value.slice(cursor);
}

self.onmessage = ({ data: { values, query, replacement, caseSensitive } }) => {
  try {
    const pattern = new RegExp(query, caseSensitive ? 'gu' : 'giu');
    self.postMessage({ values: values.map((value) => replaceBounded(value, pattern, replacement)) });
  } catch {
    self.postMessage({ invalid: true });
  }
};
