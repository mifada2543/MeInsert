import test from 'node:test';
import assert from 'node:assert/strict';
import { coverAcceptFor, coverFormatsFor, isSupportedCover } from '../../assets/js/core/image-utils.js';

const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0]);
const bmp = Uint8Array.from([0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

test('GIF and BMP are accepted for MP3, FLAC, OGG, and MKV', () => {
  for (const id of ['mp3', 'flac', 'ogg', 'mkv']) {
    assert.equal(isSupportedCover(gif, id), true, `gif ${id}`);
    assert.equal(isSupportedCover(bmp, id), true, `bmp ${id}`);
  }
});

test('GIF and BMP stay rejected for MP4 and images', () => {
  assert.equal(isSupportedCover(gif, 'mp4'), false);
  assert.equal(isSupportedCover(bmp, 'mp4'), false);
  assert.equal(isSupportedCover(gif, 'image'), false);
});

test('base cover formats remain accepted everywhere', () => {
  assert.equal(isSupportedCover(png, 'mp4'), true);
});

test('cover picker accepts match the container', () => {
  assert.match(coverAcceptFor('mp3'), /image\/gif/);
  assert.match(coverAcceptFor('mp3'), /image\/bmp/);
  assert.doesNotMatch(coverAcceptFor('mp4'), /image\/gif/);
  assert.deepEqual(coverFormatsFor('mp4'), ['image/jpeg', 'image/png', 'image/webp']);
});
