/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUE_STYLE_DEFAULTS,
  cueStyleToCss,
  cueStyleToSettings,
  normalizeCueStyle,
  parseLrc,
  serializeLrc,
  parseSrt,
  parseVtt,
  serializeVtt,
  toSyltPairs,
  formatTimestamp,
} from '../../assets/js/core/timed-text.js';

test('parseLrc strips BOM, handles CRLF and ignores metadata', () => {
  const input = '\uFEFF[ti:Judul]\r\n[ar:Penulis]\r\n[by:Penyalin]\r\n'
    + '[00:12.34] Baris satu\r\n[01:02.50] Baris dua\r\n';
  assert.deepEqual(parseLrc(input), {
    lines: [
      { time: 12340, text: 'Baris satu' },
      { time: 62500, text: 'Baris dua' },
    ],
  });
});

test('parseLrc duplicates a line for every leading timestamp and sorts by time', () => {
  const input = '[00:12.34][00:15.00] refrain\n[00:10.00] intro\n[00:12.34]再次\n';
  assert.deepEqual(parseLrc(input).lines, [
    { time: 10000, text: 'intro' },
    { time: 12340, text: 'refrain' },
    { time: 12340, text: '再次' },
    { time: 15000, text: 'refrain' },
  ]);
});

test('parseLrc skips empty lyrics, bare CR, malformed tags and other metadata', () => {
  const input = '[00:01.00]\r[al:Album]\r[length:03:20]\r[offset:+500]\r'
    + '[00:02.00]    \r[abc] not a timestamp\r[00:03.00] ok\r';
  assert.deepEqual(parseLrc(input).lines, [{ time: 3000, text: 'ok' }]);
});

test('parseLrc accepts HH:MM:SS.mmm timestamps and returns empty arrays for garbage', () => {
  assert.deepEqual(parseLrc('[01:02:03.004] tiga jam+').lines, [{ time: 3723004, text: 'tiga jam+' }]);
  for (const value of ['', '   ', 'no lyrics here', '[ti:only metadata]', null, undefined, 42, {}, []]) {
    assert.deepEqual(parseLrc(value).lines, [], `parseLrc(${String(value)})`);
  }
});

test('serializeLrc emits centiseconds and round-trips with parseLrc', () => {
  const lines = [
    { time: 12340, text: 'Baris satu' },
    { time: 62500, text: 'Baris dua' },
  ];
  const serialized = serializeLrc(lines);
  assert.equal(serialized, '[00:12.34] Baris satu\n[01:02.50] Baris dua');
  assert.deepEqual(parseLrc(serialized).lines, lines);
});

test('serializeLrc pads minutes to two digits but keeps values above 99 minutes', () => {
  const serialized = serializeLrc([{ time: 9 * 60 * 1000, text: 'a' }, { time: 100 * 60 * 1000, text: 'b' }]);
  assert.equal(serialized, '[09:00.00] a\n[100:00.00] b');
  assert.deepEqual(parseLrc(serialized).lines, [
    { time: 540000, text: 'a' },
    { time: 6000000, text: 'b' },
  ]);
  assert.equal(serializeLrc(null), '');
  assert.equal(serializeLrc([null, { time: 0, text: '' }]), '[00:00.00] ');
});

test('LRC ms precision is centiseconds (sub-10ms truncated on export)', () => {
  assert.equal(serializeLrc([{ time: 12345, text: 'x' }]), '[00:12.34] x');
});

test('parseSrt strips cue numbers, handles BOM/CRLF, comma decimals and arrow glyphs', () => {
  const input = '\uFEFF1\r\n00:00:01,000 --> 00:00:03,500\r\nHello\r\nworld\r\n\r\n'
    + '2\r\n00:00:04,000 -▶ 00:00:06,000\r\nNext\r\n\r\n'
    + '3\r\n00:00:07,000 → 00:00:08,000\r\nArrow\r\n'
    + '\r\n4\r\n00:00:09,000 –> 00:00:10,000\r\nDash\r\n';
  assert.deepEqual(parseSrt(input).cues, [
    { id: '1', start: 1000, end: 3500, text: 'Hello\nworld', settings: '' },
    { id: '2', start: 4000, end: 6000, text: 'Next', settings: '' },
    { id: '3', start: 7000, end: 8000, text: 'Arrow', settings: '' },
    { id: '4', start: 9000, end: 10000, text: 'Dash', settings: '' },
  ]);
});

test('parseSrt supports cues without ids and MM:SS,mmm timestamps', () => {
  const input = '00:01,500 -> 00:02,000\nPertama\n\n'
    + '00:03,000 --> 00:04,000 align:start\nKedua\n';
  assert.deepEqual(parseSrt(input).cues, [
    { id: null, start: 1500, end: 2000, text: 'Pertama', settings: '' },
    { id: null, start: 3000, end: 4000, text: 'Kedua', settings: '' },
  ]);
});

test('parseSrt returns empty cues for empty, garbage and non-string input', () => {
  for (const value of ['', 'garbage\nno timing', '[00:01.00] lyric', null, undefined, 7, {}]) {
    assert.deepEqual(parseSrt(value).cues, [], `parseSrt(${String(value)})`);
  }
});

test('parseVtt skips header, NOTE/STYLE/REGION blocks and keeps ids/settings', () => {
  const input = [
    'WEBVTT - Demo',
    '',
    'NOTE ini komentar',
    'baris kedua catatan',
    '',
    'STYLE',
    '::cue { color: lime; }',
    '',
    'REGION',
    'id:bottom',
    '',
    'intro',
    '00:00:01.000 --> 00:00:02.500 align:start position:50%',
    'Halo',
    'dunia',
    '',
    '00:01:00.000 --> 00:01:02.000',
    'Tanpa id',
    '',
    '00:03.000 --> 00:04.000 line:0%',
    'Pendek',
  ].join('\n');
  assert.deepEqual(parseVtt(input).cues, [
    { id: 'intro', start: 1000, end: 2500, text: 'Halo\ndunia', settings: 'align:start position:50%' },
    { id: null, start: 60000, end: 62000, text: 'Tanpa id', settings: '' },
    { id: null, start: 3000, end: 4000, text: 'Pendek', settings: 'line:0%' },
  ]);
});

test('parseVtt handles BOM and CRLF input', () => {
  const input = '\uFEFFWEBVTT\r\n\r\n00:00:00.100 --> 00:00:00.200\r\nHi\r\n';
  assert.deepEqual(parseVtt(input).cues, [
    { id: null, start: 100, end: 200, text: 'Hi', settings: '' },
  ]);
});

test('parseVtt returns empty cues for empty, garbage and non-string input', () => {
  for (const value of ['', 'WEBVTT', 'not a vtt file', '1\nnot a timing line', null, undefined, 3, []]) {
    assert.deepEqual(parseVtt(value).cues, [], `parseVtt(${String(value)})`);
  }
});

test('serializeVtt writes the header, style block, ids, timing lines and settings', () => {
  assert.equal(serializeVtt([]), 'WEBVTT\n\n');
  const cues = [
    { id: 'intro', start: 1000, end: 2500, text: 'Halo\ndunia', settings: 'position:50%' },
    { id: null, start: 60000, end: 62000, text: 'Tanpa id', settings: '' },
  ];
  const settings = cueStyleToSettings(CUE_STYLE_DEFAULTS);
  assert.equal(serializeVtt(cues), [
    'WEBVTT',
    '',
    `STYLE\n${cueStyleToCss(CUE_STYLE_DEFAULTS)}`,
    '',
    'intro',
    `00:00:01.000 --> 00:00:02.500 ${settings} position:50%`,
    '<c.mi-cue>Halo\ndunia</c>',
    '',
    `00:01:00.000 --> 00:01:02.000 ${settings}`,
    '<c.mi-cue>Tanpa id</c>',
  ].join('\n'));
});
test('cue style settings sanitize colors and map position/alignment', () => {
  const style = normalizeCueStyle({
    theme: 'custom', color: '#abc', bgColor: '#123456', bgOpacity: 2,
    fontSize: 'large', bold: false, outline: false, position: 'top', align: 'start',
  });
  assert.equal(style.color, '#FFFFFF');
  assert.equal(style.bgColor, '#123456');
  assert.equal(style.bgOpacity, 1);
  assert.equal(cueStyleToSettings(style), 'align:start line:10% size:80%');
  assert.match(cueStyleToCss(style), /color: #FFFFFF/);
  assert.match(cueStyleToCss(style), /rgba\(18, 52, 86, 1\)/);
});

test('VTT import -> export -> import preserves cues exactly', () => {
  const input = [
    'WEBVTT',
    '',
    'NOTE skipped',
    '',
    'a',
    '00:00:01.000 --> 00:00:02.500 position:50%',
    'Baris',
    'kedua',
    '',
    '01:02:03.004 --> 01:02:05.006',
    'Terakhir',
  ].join('\n');
  const original = parseVtt(input).cues;
  const settings = cueStyleToSettings(CUE_STYLE_DEFAULTS);
  const expected = original.map((cue) => ({
    ...cue,
    settings: `${settings}${cue.settings ? ` ${cue.settings}` : ''}`,
  }));
  assert.deepEqual(parseVtt(serializeVtt(original)).cues, expected);
});

test('SRT import -> VTT export -> VTT import preserves cue fields', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHalo\r\ndunia\r\n';
  const cues = parseSrt(srt).cues;
  const expected = cues.map((cue) => ({ ...cue, settings: cueStyleToSettings(CUE_STYLE_DEFAULTS) }));
  assert.deepEqual(parseVtt(serializeVtt(cues)).cues, expected);
});

test('LRC import -> export -> import and toSyltPairs use millisecond pairs', () => {
  const { lines } = parseLrc('\uFEFF[00:12.34][00:15.00] refrain\r\n[00:10.00] intro\r\n');
  assert.deepEqual(parseLrc(serializeLrc(lines)).lines, lines);
  assert.deepEqual(toSyltPairs(lines), [
    ['intro', 10000],
    ['refrain', 12340],
    ['refrain', 15000],
  ]);
});

test('toSyltPairs skips empty/invalid entries and coerces bad times to zero', () => {
  assert.deepEqual(toSyltPairs([
    null,
    { time: 500, text: '' },
    { time: '1500', text: 'string time' },
    { time: NaN, text: 'bad time' },
    { time: -5, text: 'negative' },
  ]), [
    ['string time', 1500],
    ['bad time', 0],
    ['negative', 0],
  ]);
  assert.deepEqual(toSyltPairs(null), []);
  assert.deepEqual(toSyltPairs('nope'), []);
});

test('formatTimestamp renders MM:SS and is defensive', () => {
  assert.equal(formatTimestamp(0), '00:00');
  assert.equal(formatTimestamp(12340), '00:12');
  assert.equal(formatTimestamp(62500), '01:02');
  assert.equal(formatTimestamp(3661000), '61:01');
  assert.equal(formatTimestamp(-5), '00:00');
  assert.equal(formatTimestamp(NaN), '00:00');
  assert.equal(formatTimestamp(null), '00:00');
});
