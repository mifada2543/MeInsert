/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEAN_CATEGORIES,
  CLEAN_PROFILE_CATEGORIES,
  categorizeRawTag,
  summarizeCleaning,
  buildCleanPayload,
  isCleanableField,
} from '../../assets/js/core/privacy-categories.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
const jpeg = {
  meta: { id: 'jpeg', label: 'JPEG' },
  fields: [
    { id: 'title', label: 'Judul', native: 'XMP-dc:Title' },
    { id: 'creator', label: 'Pembuat', native: 'XMP-dc:Creator + EXIF:Artist' },
    { id: 'software', label: 'Perangkat lunak', native: 'XMP-xmp:CreatorTool + EXIF:Software' },
  ],
};
const mp3 = {
  meta: { id: 'mp3', label: 'MP3' },
  fields: [
    { id: 'title', label: 'Judul', native: 'TIT2' },
    { id: 'artist', label: 'Artis', native: 'TPE1' },
  ],
};
const pdf = {
  meta: { id: 'pdf', label: 'PDF' },
  fields: [
    { id: 'title', label: 'Judul', native: 'dc:title' },
    { id: 'author', label: 'Penulis', native: '/Author' },
  ],
};
const mp4 = {
  meta: { id: 'mp4', label: 'MP4' },
  fields: [
    { id: 'title', label: 'Judul', native: '©nam' },
    { id: 'artist', label: 'Artis', native: '©ART' },
  ],
};
const mkv = {
  meta: { id: 'mkv', label: 'MKV' },
  fields: [{ id: 'artist', label: 'Artis', native: 'ARTIST' }],
};
const vorbis = {
  meta: { id: 'ogg', label: 'OGG' },
  fields: [{ id: 'artist', label: 'Artis', native: 'ARTIST' }],
};
function snapshot(adapter, readResult = {}) {
  return createSnapshot({
    adapter,
    detection: { id: adapter.meta.id, subtype: adapter.meta.id, label: adapter.meta.label },
    readResult: {
      fields: {}, custom: [], raw: [], info: {}, warnings: [], ...readResult,
    },
  });
}
test('exports the exact shared category and profile contract', () => {
  assert.deepEqual(CLEAN_CATEGORIES, ['location', 'device', 'identity', 'software', 'thumbnail', 'history']);
  assert.deepEqual(CLEAN_PROFILE_CATEGORIES.privacy, CLEAN_CATEGORIES);
  assert.deepEqual(CLEAN_PROFILE_CATEGORIES.all, CLEAN_CATEGORIES);
  assert.deepEqual(CLEAN_PROFILE_CATEGORIES.custom, []);
});
test('location tags are detected in images, video, audio, and PDF', () => {
  assert.equal(categorizeRawTag('jpeg', 'EXIF:GPSLatitude'), 'location');
  assert.equal(categorizeRawTag('jpeg', 'XMP-iptcExt:LocationCreatedCity'), 'location');
  assert.equal(categorizeRawTag('mp4', 'QuickTime:GPSLongitude'), 'location');
  assert.equal(categorizeRawTag('mkv', 'MATROSKA:LOCATION'), 'location');
  assert.equal(categorizeRawTag('ogg', 'LOCATION'), 'location');
  assert.equal(categorizeRawTag('pdf', 'XMP-iptcExt:LocationCreatedCountryName'), 'location');
});
test('new image GPS and IPTC fields are classified as location', () => {
  for (const tag of [
    'GPS:GPSLatitude', 'GPS:GPSLatitudeRef', 'GPS:GPSLongitude', 'GPS:GPSLongitudeRef',
    'GPS:GPSAltitude', 'GPS:GPSDateStamp',
  ]) {
    assert.equal(categorizeRawTag('image', tag), 'location', tag);
  }
  assert.equal(categorizeRawTag('image', 'XMP-iptcCore:Location'), 'location');
  assert.equal(categorizeRawTag('image', 'gpsLatitude'), 'location');
  assert.equal(categorizeRawTag('image', 'gpsDate'), 'location');
  assert.equal(isCleanableField('image', 'gpsLatitude'), true);
  assert.equal(isCleanableField('image', 'location'), true);
  assert.equal(isCleanableField('image', 'credit'), false);
});
test('GPS fields contribute to the location cleaning category', () => {
  const summary = summarizeCleaning({
    format: { id: 'image' },
    fields: {
      gpsLatitude: { id: 'gpsLatitude', label: 'Lintang', value: '-6.2088', normalized: '-6.2088' },
      location: { id: 'location', label: 'Lokasi', value: 'Jakarta', normalized: 'Jakarta' },
      title: { id: 'title', label: 'Judul', value: 'Foto', normalized: 'Foto' },
    },
    raw: [{ group: 'GPS', tag: 'GPS:GPSLatitudeRef', value: 'South' }],
    custom: [],
    cover: { present: false },
  });
  assert.equal(summary.categories.location.count, 3);
  assert.equal(summary.total, 3);
});
test('device tags are detected in images, video, audio, and PDF', () => {
  assert.equal(categorizeRawTag('jpeg', 'EXIF:BodySerialNumber'), 'device');
  assert.equal(categorizeRawTag('jpeg', 'EXIF:CameraOwnerName'), 'device');
  assert.equal(categorizeRawTag('jpeg', 'EXIF:ImageUniqueID'), 'device');
  assert.equal(categorizeRawTag('pdf', 'XMP-exif:SerialNumber'), 'device');
  assert.equal(categorizeRawTag('mp4', 'QuickTime:SerialNumber'), 'device');
  assert.equal(categorizeRawTag('ogg', 'SERIALNUMBER'), 'device');
});
test('identity tags are detected in images, PDF, MP3, and audio containers', () => {
  assert.equal(categorizeRawTag('jpeg', 'EXIF:Artist'), 'identity');
  assert.equal(categorizeRawTag('jpeg', 'EXIF:OwnerName'), 'identity');
  assert.equal(categorizeRawTag('jpeg', 'EXIF:CameraOwnerName'), 'device');
  assert.equal(categorizeRawTag('jpeg', 'XMP-dc:Creator'), 'identity');
  assert.equal(categorizeRawTag('pdf', '/Author'), 'identity');
  assert.equal(categorizeRawTag('mp3', 'TPE1'), 'identity');
  assert.equal(categorizeRawTag('mp3', 'TPE2'), 'identity');
  assert.equal(categorizeRawTag('ogg', 'ARTIST'), 'identity');
});
test('software tags are detected in images, PDF, MP3, and audio containers', () => {
  assert.equal(categorizeRawTag('jpeg', 'EXIF:Software'), 'software');
  assert.equal(categorizeRawTag('jpeg', 'XMP-xmp:CreatorTool'), 'software');
  assert.equal(categorizeRawTag('pdf', '/Creator'), 'software');
  assert.equal(categorizeRawTag('mp3', 'TENC'), 'software');
  assert.equal(categorizeRawTag('ogg', 'ENCODER'), 'software');
  assert.equal(categorizeRawTag('mkv', 'ENCODER'), 'software');
});
test('thumbnail and history tags are detected across formats', () => {
  assert.equal(categorizeRawTag('jpeg', 'EXIF:ThumbnailOffset'), 'thumbnail');
  assert.equal(categorizeRawTag('jpeg', 'File:PreviewImage'), 'thumbnail');
  assert.equal(categorizeRawTag('mp4', 'QuickTime:PreviewImage'), 'thumbnail');
  assert.equal(categorizeRawTag('jpeg', 'XMP-xmpMM:History'), 'history');
  assert.equal(categorizeRawTag('pdf', 'XMP-xmpMM:DerivedFrom'), 'history');
  assert.equal(categorizeRawTag('pdf', 'XMP-xmpMM:OriginalDocumentID'), 'history');
  assert.equal(categorizeRawTag('mp4', 'XMP-xmp:MetadataDate'), 'history');
  assert.equal(categorizeRawTag('mkv', 'XMP-xmpMM:History'), 'history');
});
test('orientation, generated tags, and structural tags are never cleanable', () => {
  for (const tag of [
    'EXIF:Orientation', 'QuickTime:Rotate', 'XMP-tiff:Orientation',
    'File:FileName', 'System:FileType', 'ExifTool:ExifToolVersion', 'Composite:GPSPosition',
    'DURATION', 'QuickTime:Duration', 'VideoCodec', 'AudioCodec', 'SampleRate',
    'Channels', 'PageCount', 'ImageWidth', 'File:FileSize',
  ]) {
    assert.equal(categorizeRawTag('jpeg', tag), null, `unexpected category for ${tag}`);
  }
  assert.equal(isCleanableField('jpeg', 'orientation'), false);
  assert.equal(isCleanableField('mp4', 'rotate'), false);
  assert.equal(isCleanableField('mkv', 'duration'), false);
  assert.equal(isCleanableField('mp3', 'title'), false);
});
test('isCleanableField only clears clear identity/software field names', () => {
  assert.equal(isCleanableField('jpeg', 'creator'), true);
  assert.equal(isCleanableField('jpeg', 'software'), true);
  assert.equal(isCleanableField('mp3', 'artist'), true);
  assert.equal(isCleanableField('mp3', 'albumartist'), true);
  assert.equal(isCleanableField('pdf', 'author'), true);
  assert.equal(isCleanableField('pdf', 'creator'), true);
  assert.equal(isCleanableField('ogg', 'artist'), true);
  for (const id of ['title', 'description', 'keywords', 'comment', 'date', 'make', 'model', 'lens', '', null]) {
    assert.equal(isCleanableField('jpeg', id), false, `unexpected cleanable field ${id}`);
  }
});
test('summarizeCleaning buckets sensitive tags and records preserved tags with reasons', () => {
  const direct = {
    format: { id: 'jpeg' },
    fields: {
      creator: { id: 'creator', label: 'Pembuat', value: 'Jane Doe', normalized: 'Jane Doe' },
      orientation: { id: 'orientation', label: 'Orientasi', value: '6', normalized: '6', native: 'EXIF:Orientation' },
      title: { id: 'title', label: 'Judul', value: 'Sunset', normalized: 'Sunset' },
    },
    custom: [{ key: 'GPSLatitude', canonicalKey: 'gpslatitude', value: '-6.2' }],
    raw: [
      { tag: 'EXIF:GPSLatitude', canonicalTag: 'exif:gpslatitude', group: 'EXIF', value: '-6.2' },
      { tag: 'EXIF:GPSLatitude', canonicalTag: 'exif:gpslatitude', group: 'EXIF', value: '-6.2' },
      { tag: 'EXIF:Orientation', canonicalTag: 'exif:orientation', group: 'EXIF', value: '6' },
      { tag: 'File:FileName', canonicalTag: 'file:filename', group: 'File', value: 'photo.jpg' },
      { tag: 'QuickTime:Duration', canonicalTag: 'quicktime:duration', group: 'QuickTime', value: '3.2' },
      { tag: 'Software', canonicalTag: 'software', group: 'EXIF', value: 'Editor' },
    ],
    cover: { present: false },
  };
  const result = summarizeCleaning(direct);
  assert.equal(result.categories.location.count, 2);
  assert.equal(result.categories.software.count, 1);
  assert.equal(result.categories.identity.count, 1);
  assert.equal(result.total, 4);
  assert.equal(result.sensitive.length, 4);
  assert.deepEqual(result.kept.map((row) => row.tag), ['orientation', 'EXIF:Orientation', 'File:FileName', 'QuickTime:Duration']);
  assert.ok(result.kept.every((row) => typeof row.reason === 'string' && row.reason.length > 0));
  for (const category of CLEAN_CATEGORIES) {
    assert.ok(Array.isArray(result.categories[category].tags), `missing tags array for ${category}`);
  }
});
test('buildCleanPayload emits a deduplicated standard payload and an accurate count', () => {
  const base = snapshot(jpeg, {
    fields: { creator: 'Jane Doe', software: 'Editor', title: 'Sunset' },
    raw: [
      { group: 'EXIF', tag: 'EXIF:GPSLatitude', value: '-6.2' },
      { group: 'EXIF', tag: 'EXIF:GPSLatitude', value: '-6.2' },
      { group: 'EXIF', tag: 'EXIF:GPSLongitude', value: '106.8' },
      { group: 'EXIF', tag: 'EXIF:Orientation', value: '6' },
      { group: 'EXIF', tag: 'EXIF:Software', value: 'Editor' },
      { group: 'EXIF', tag: 'EXIF:ImageUniqueID', value: 'abc-123' },
      { group: 'Thumbnail', tag: 'ThumbnailImage', value: '[data biner]' },
      { group: 'XMP-xmpMM', tag: 'XMP-xmpMM:History', value: 'saved' },
      { group: 'File', tag: 'File:FileName', value: 'photo.jpg' },
    ],
    custom: [
      { key: 'Owner', value: 'Jane Doe' },
      { key: 'Owner', value: 'Jane Doe' },
      { key: 'MOOD', value: 'Calm' },
    ],
    info: { hasCover: true },
  });
  const payload = buildCleanPayload(base, CLEAN_PROFILE_CATEGORIES.privacy);
  assert.deepEqual(payload.set, {});
  assert.deepEqual(payload.custom, []);
  assert.equal(new Set(payload.remove).size, payload.remove.length);
  assert.equal(new Set(payload.rawRemove).size, payload.rawRemove.length);
  assert.equal(new Set(payload.customRemove).size, payload.customRemove.length);
  assert.deepEqual(payload.remove.sort(), ['creator', 'software']);
  assert.equal(payload.rawRemove.filter((tag) => tag === 'EXIF:GPSLatitude').length, 1);
  assert.deepEqual(payload.cover, { action: 'remove' });
  assert.deepEqual(payload.customRemove, ['Owner']);
  assert.ok(payload.rawRemove.includes('EXIF:ImageUniqueID'));
  assert.ok(payload.rawRemove.includes('XMP-xmpMM:History'));
  assert.ok(payload.rawRemove.includes('ThumbnailImage'));
  assert.equal(payload.rawRemove.includes('EXIF:Orientation'), false);
  assert.equal(payload.rawRemove.includes('File:FileName'), false);
  assert.equal(payload.count, payload.remove.length + payload.rawRemove.length + payload.customRemove.length + 1);
  const summary = summarizeCleaning(base);
  assert.equal(summary.total, payload.count);
});
test('payload produced by buildCleanPayload is accepted by buildChangePlan', () => {
  const base = snapshot(mp3, {
    fields: { artist: 'Jane Doe', title: 'Lagu' },
    raw: [
      { group: 'ID3', tag: 'TPE1', value: 'Jane Doe' },
      { group: 'ID3', tag: 'TENC', value: 'Encoder' },
      { group: 'ID3', tag: 'TIT2', value: 'Lagu' },
    ],
  });
  const payload = buildCleanPayload(base, ['identity', 'software']);
  const plan = buildChangePlan({
    adapter: mp3,
    detection: { id: 'mp3', subtype: 'mp3', label: 'MP3' },
    baseline: base,
    payload,
  });
  assert.equal(plan.hasOperations, true);
  assert.equal(plan.operations.length, payload.count);
  assert.ok(plan.operations.every((op) => op.action === 'remove'));
  assert.equal(plan.operations.some((op) => op.kind === 'field' && op.id === 'artist'), true);
  assert.equal(plan.operations.some((op) => op.kind === 'raw' && op.tag === 'TENC'), true);
  assert.equal(plan.operations.some((op) => op.tag === 'TIT2'), false);
});
test('custom profile selects no categories, privacy and all select every category', () => {
  const base = snapshot(jpeg, {
    fields: { creator: 'Jane Doe', software: 'Editor' },
    raw: [{ group: 'EXIF', tag: 'EXIF:GPSLatitude', value: '-6.2' }],
    info: { hasCover: true },
  });
  for (const profile of ['privacy', 'all']) {
    const payload = buildCleanPayload(base, CLEAN_PROFILE_CATEGORIES[profile]);
    assert.equal(payload.count, 4, `${profile} should remove both fields, one raw tag, and the cover`);
  }
  const custom = buildCleanPayload(base, CLEAN_PROFILE_CATEGORIES.custom);
  assert.equal(custom.count, 0);
  assert.deepEqual(custom.remove, []);
  assert.deepEqual(custom.rawRemove, []);
  assert.equal(custom.cover, null);
});
test('empty and unknown snapshots are safe', () => {
  for (const value of [undefined, null, {}, { format: { id: 'unknown' } }]) {
    const summary = summarizeCleaning(value);
    assert.equal(summary.total, 0);
    assert.equal(summary.sensitive.length, 0);
    assert.equal(summary.kept.length, 0);
    for (const category of CLEAN_CATEGORIES) {
      assert.equal(summary.categories[category].count, 0);
    }
    const payload = buildCleanPayload(value, CLEAN_PROFILE_CATEGORIES.all);
    assert.equal(payload.count, 0);
    assert.deepEqual(payload.remove, []);
    assert.deepEqual(payload.rawRemove, []);
    assert.deepEqual(payload.customRemove, []);
    assert.equal(payload.cover, null);
  }
});
test('each category is exercised across at least two format families through snapshots', () => {
  const families = [
    snapshot(jpeg, {
      raw: [
        { group: 'EXIF', tag: 'EXIF:GPSLatitude', value: '-6.2' },
        { group: 'EXIF', tag: 'EXIF:BodySerialNumber', value: 'S1' },
        { group: 'EXIF', tag: 'EXIF:Artist', value: 'Jane' },
        { group: 'EXIF', tag: 'EXIF:Software', value: 'Editor' },
        { group: 'EXIF', tag: 'EXIF:ThumbnailOffset', value: '123' },
        { group: 'XMP-xmpMM', tag: 'XMP-xmpMM:History', value: 'saved' },
      ],
    }),
    snapshot(mp4, {
      raw: [
        { group: 'QuickTime', tag: 'QuickTime:GPSLongitude', value: '106.8' },
        { group: 'QuickTime', tag: 'QuickTime:SerialNumber', value: 'S2' },
        { group: 'QuickTime', tag: 'QuickTime:Artist', value: 'Jane' },
        { group: 'QuickTime', tag: 'QuickTime:Software', value: 'Encoder' },
        { group: 'QuickTime', tag: 'QuickTime:PreviewImage', value: 'preview' },
        { group: 'XMP-xmpMM', tag: 'XMP-xmpMM:DerivedFrom', value: 'original' },
      ],
    }),
    snapshot(mp3, {
      raw: [
        { group: 'ID3', tag: 'TXXX:LOCATION', value: 'London' },
        { group: 'ID3', tag: 'TXXX:SERIALNUMBER', value: 'S3' },
        { group: 'ID3', tag: 'TPE1', value: 'Jane' },
        { group: 'ID3', tag: 'TENC', value: 'Encoder' },
      ],
    }),
    snapshot(pdf, {
      raw: [
        { group: 'XMP-iptcExt', tag: 'XMP-iptcExt:LocationCreatedCity', value: 'Jakarta' },
        { group: 'XMP-exif', tag: 'XMP-exif:SerialNumber', value: 'S4' },
        { group: 'PDF', tag: '/Author', value: 'Jane' },
        { group: 'PDF', tag: '/Creator', value: 'Writer' },
        { group: 'XMP-xmpMM', tag: 'XMP-xmpMM:OriginalDocumentID', value: 'uuid' },
      ],
    }),
    snapshot(mkv, {
      raw: [
        { group: 'MATROSKA', tag: 'LOCATION', value: 'Bandung' },
        { group: 'MATROSKA', tag: 'SERIALNUMBER', value: 'S5' },
        { group: 'MATROSKA', tag: 'ARTIST', value: 'Jane' },
        { group: 'MATROSKA', tag: 'ENCODER', value: 'Encoder' },
        { group: 'XMP-xmpMM', tag: 'XMP-xmpMM:History', value: 'saved' },
      ],
    }),
    snapshot(vorbis, {
      raw: [
        { group: 'Vorbis', tag: 'LOCATION', value: 'Surabaya' },
        { group: 'Vorbis', tag: 'SERIALNUMBER', value: 'S6' },
        { group: 'Vorbis', tag: 'ARTIST', value: 'Jane' },
        { group: 'Vorbis', tag: 'ENCODER', value: 'Encoder' },
      ],
    }),
  ];
  const totals = Object.fromEntries(CLEAN_CATEGORIES.map((category) => [category, 0]));
  for (const item of families) {
    const summary = summarizeCleaning(item);
    for (const category of CLEAN_CATEGORIES) totals[category] += summary.categories[category].count;
  }
  for (const category of CLEAN_CATEGORIES) {
    assert.ok(totals[category] >= 2, `category ${category} was found in fewer than two formats (${totals[category]})`);
  }
});