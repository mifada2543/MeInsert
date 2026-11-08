/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
const KNOWN_ID3_FRAME = {
  code: 'UNKNOWN_ID3_FRAME',
  message: 'Frame ID3 yang tidak didukung hilang saat metadata ditulis ulang.',
};
const KNOWN_ID3 = new Set([
  'TIT2', 'TPE1', 'TALB', 'TPE2', 'TYER', 'TDRC', 'TCON', 'TRCK', 'TPOS',
  'TCOM', 'COMM', 'USLT', 'TCOP', 'TSSE', 'TENC', 'TXXX', 'APIC', 'TDAT',
  'TIME', 'TRDA', 'TEXT', 'TIT1', 'TIT3', 'TPUB', 'TBPM', 'TKEY', 'TLAN',
  'TCMP', 'TSRC', 'TLEN', 'WXXX', 'WCOM', 'WCOP', 'WOAF', 'WOAR', 'WOAS',
  'WORS', 'WPAY', 'WPUB', 'PRIV', 'CHAP', 'CTOC', 'SYLT', 'IPLS',
]);
export const FORMAT_RULES = {
  pdf: {
    ignoredRaw: [/^\/Metadata$/i],
    volatileRaw: [],
    generatedRaw: [],
    coverRaw: [],
    knownLoss: [
      {
        code: 'PDF_XMP_REWRITE',
        test: (tag) => /^\/Metadata$/i.test(tag),
        message: 'XMP PDF ditulis ulang; properti asing mungkin tidak terbaca oleh verifikator.',
      },
    ],
  },
  image: {
    ignoredRaw: [/^ICC_Profile:/i, /^XMP-xmpMM:/i],
    volatileRaw: [/^XMP-xmp:MetadataDate$/i],
    generatedRaw: [/^XMP-xmp:MetadataDate$/i],
    coverRaw: [],
    knownLoss: [],
  },
  mp3: {
    ignoredRaw: [],
    volatileRaw: [],
    generatedRaw: [/^TSSE$/i],
    coverRaw: [/^APIC$/i],
    knownLoss: [
      {
        ...KNOWN_ID3_FRAME,
        test: (tag) => /^[A-Z0-9]{4}$/.test(tag) && !KNOWN_ID3.has(tag),
      },
    ],
  },
  mp4: {
    ignoredRaw: [],
    volatileRaw: [/^QuickTime:ModifyDate$/i, /^XMP-xmp:MetadataDate$/i],
    generatedRaw: [/^QuickTime:ModifyDate$/i, /^XMP-xmp:MetadataDate$/i],
    coverRaw: [/CoverArt/i],
    knownLoss: [],
  },
  flac: {
    ignoredRaw: [],
    volatileRaw: [],
    generatedRaw: [/^ENCODER$/i],
    coverRaw: [/^METADATA_BLOCK_PICTURE$/i],
    knownLoss: [],
  },
  ogg: {
    ignoredRaw: [],
    volatileRaw: [],
    generatedRaw: [/^ENCODER$/i],
    coverRaw: [/^METADATA_BLOCK_PICTURE$/i],
    knownLoss: [],
  },
  mkv: {
    ignoredRaw: [],
    volatileRaw: [/^DURATION$/i],
    generatedRaw: [/^ENCODER$/i, /^DURATION$/i],
    coverRaw: [/COVERART/i],
    knownLoss: [
      {
        code: 'MKV_REWRITE',
        test: () => false,
        message: 'Container MKV/WebM ditulis ulang; chapter/attachment mungkin tidak dipertahankan.',
      },
    ],
  },
};
export function rulesFor(formatId) {
  return FORMAT_RULES[formatId] || {};
}
function testPatterns(patterns, row) {
  const tag = row?.tag || '';
  return (patterns || []).some((pattern) => (pattern instanceof RegExp ? pattern.test(tag) : false));
}
export function isIgnoredRaw(row, rules) {
  return testPatterns(rules?.ignoredRaw, row);
}
export function isVolatileRaw(row, rules) {
  return testPatterns(rules?.volatileRaw, row);
}
export function isGeneratedRaw(row, rules) {
  return testPatterns(rules?.generatedRaw, row);
}
export function isCoverRaw(row, rules) {
  return testPatterns(rules?.coverRaw, row);
}
export function knownLossFor(row, rules) {
  const tag = row?.tag || '';
  for (const rule of rules?.knownLoss || []) {
    if (typeof rule.test === 'function' && rule.test(tag)) {
      return { code: rule.code, message: rule.message };
    }
  }
  return null;
}
export function nativeTagsForField(field) {
  const native = String(field?.native || '');
  const tags = new Set();
  for (const match of native.matchAll(/(?:Info\s+)?\/([A-Za-z][A-Za-z0-9_]*)/g)) {
    tags.add(`/${match[1]}`.toLowerCase());
  }
  for (const match of native.matchAll(/\b[A-Z][A-Za-z0-9_-]*:[A-Za-z0-9_]+\b/g)) {
    tags.add(match[0].toLowerCase());
  }
  for (const match of native.matchAll(/\b[A-Z0-9]{4}\b/g)) {
    tags.add(match[0].toLowerCase());
  }
  for (const match of native.matchAll(/\b(TITLE|ARTIST|ALBUM|ALBUMARTIST|DATE|DATE_RELEASED|GENRE|DESCRIPTION|COMMENT|COPYRIGHT|ENCODER|TRACKNUMBER|TRACKTOTAL|DISCNUMBER|DISCTOTAL|COMPOSER|LYRICS)\b/g)) {
    tags.add(match[0].toLowerCase());
  }
  return tags;
}
