/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFHexString, PDFString } from 'pdf-lib';
import { writeTags as writeImageTags } from '../../assets/js/engines/exiftool.js';

const dir = fileURLToPath(new URL('.', import.meta.url));
const out = (name, bytes) => writeFileSync(join(dir, name), bytes);
const read = (name) => readFileSync(join(dir, name));
function ff(args, name) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, join(dir, name)]);
}
const tags = ['-metadata', 'title=Synthetic fixture', '-metadata', 'artist=MeInsert fixture',
  '-metadata', 'album=Compatibility', '-metadata', 'comment=Preserve this comment'];
const tone = ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.25'];
for (const [name, codec, extra] of [
  ['tone.mp3', 'libmp3lame', ['-id3v2_version', '3']],
  ['tone.flac', 'flac', []], ['tone.opus', 'libopus', []],
  ['tone.ogg', 'libvorbis', []], ['reject-flac.ogg', 'flac', ['-f', 'ogg']],
  ['reject-speex.ogg', 'libspeex', ['-ar', '16000', '-f', 'ogg']],
]) ff([...tone, '-c:a', codec, ...tags, ...extra], name);

// TIFF IFD offsets are relative to the II/42 header, NOT the JPEG APP1 header.
// EXIF Artist, Software, ImageDescription, XPTitle, XPKeywords, ExifIFD date.
function exif() {
  const entries = [
    [0x010e, 2, Buffer.from('Synthetic image\0')],
    [0x0131, 2, Buffer.from('MeInsert generator\0')],
    [0x013b, 2, Buffer.from('MeInsert fixture\0')],
    [0x9c9b, 1, Buffer.from('Synthetic title\0', 'utf16le')],
    [0x9c9e, 1, Buffer.from('synthetic;compatibility\0', 'utf16le')],
  ];
  const offset = 8 + 2 + 6 * 12 + 4;
  let pos = offset;
  const ifd = Buffer.alloc(offset);
  ifd.write('II'); ifd.writeUInt16LE(42, 2); ifd.writeUInt32LE(8, 4);
  ifd.writeUInt16LE(6, 8);
  entries.forEach(([tag, type, bytes], i) => {
    const p = 10 + i * 12;
    ifd.writeUInt16LE(tag, p); ifd.writeUInt16LE(type, p + 2);
    ifd.writeUInt32LE(bytes.length, p + 4); ifd.writeUInt32LE(pos, p + 8);
    pos += bytes.length;
  });
  const pointer = 10 + 5 * 12;
  ifd.writeUInt16LE(0x8769, pointer); ifd.writeUInt16LE(4, pointer + 2);
  ifd.writeUInt32LE(1, pointer + 4); ifd.writeUInt32LE(pos, pointer + 8);
  const sub = Buffer.alloc(18);
  sub.writeUInt16LE(1); sub.writeUInt16LE(0x9003, 2); sub.writeUInt16LE(2, 4);
  sub.writeUInt32LE(20, 6); sub.writeUInt32LE(pos + 18, 10);
  return Buffer.concat([ifd, ...entries.map((e) => e[2]), sub, Buffer.from('2026:01:02 03:04:05\0')]);
}
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const body = Buffer.concat([Buffer.from(type), bytes]);
  const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(32); ihdr.writeUInt32BE(32, 4); ihdr[8] = 8; ihdr[9] = 2;
const pixels = Buffer.alloc(32 * (1 + 32 * 3));
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const p = y * 97 + 1 + x * 3;
  pixels[p] = x * 8; pixels[p + 1] = y * 8; pixels[p + 2] = 120;
}
out('pattern.png', Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr),
  chunk('eXIf', exif()), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]));
execFileSync('convert', [join(dir, 'pattern.png'), '-strip', join(dir, 'pattern.jpg')]);
const jpg = read('pattern.jpg');
const app = Buffer.concat([Buffer.from('Exif\0\0'), exif()]);
const len = Buffer.alloc(2); len.writeUInt16BE(app.length + 2);
out('pattern.jpg', Buffer.concat([jpg.subarray(0, 2), Buffer.from([255, 225]), len, app, jpg.subarray(2)]));
const gpsIptcTags = {
  'XMP-dc:Title': 'Foto uji GPS IPTC',
  'XMP-dc:Creator': 'Fotografer Uji',
  'XMP-dc:Description': 'Foto sintetis dengan GPS dan IPTC',
  'XMP-dc:Subject': ['gps', 'iptc', 'uji'],
  'XMP-dc:Rights': '© 2026 MeInsert',
  'XMP-dc:Identifier': 'id-uji-001',
  'XMP-xmp:CreateDate': '2026:01:02 03:04:05',
  'XMP-xmp:CreatorTool': 'MeInsert fixture',
  'XMP-xmp:Rating': 4,
  'XMP-xmp:Label': 'Uji',
  'XMP-photoshop:Credit': 'Kredit uji',
  'XMP-photoshop:Source': 'Sumber uji',
  'XMP-photoshop:CaptionWriter': 'Penulis uji',
  'XMP-photoshop:AuthorsPosition': 'Jabatan uji',
  'XMP-plus:CopyrightOwnerName': 'Pemilik uji',
  'XMP-iptcCore:Location': 'Jakarta',
  'GPS:GPSLatitude': '6.2088',
  'GPS:GPSLatitudeRef': 'S',
  'GPS:GPSLongitude': '106.8456',
  'GPS:GPSLongitudeRef': 'E',
  'GPS:GPSAltitude': '12.5',
  'GPS:GPSDateStamp': '2026:01:02',
  'IPTC:Credit': 'Kredit IPTC',
  'IPTC:Source': 'Sumber IPTC',
  'IPTC:By-line': 'Fotografer IPTC',
  'IPTC:Caption-Abstract': 'Deskripsi IPTC',
  'IPTC:Keywords': ['gps', 'iptc'],
  'IPTC:CopyrightNotice': '© 2026 IPTC',
};
out('gps-iptc.jpg', await writeImageTags(new File([read('pattern.jpg')], 'input.jpg', { type: 'image/jpeg' }), gpsIptcTags));
ff(['-i', join(dir, 'pattern.png'), '-frames:v', '1', '-c:v', 'libwebp'], 'pattern.webp');
execFileSync('convert', [join(dir, 'pattern.png'), '-strip', join(dir, 'pattern.tif')]);
for (const ext of ['gif', 'bmp']) execFileSync('convert', [join(dir, 'pattern.png'), '-strip', join(dir, `cover.${ext}`)]);
out('mislabeled.jpg', read('pattern.png'));

// Embed a real FLAC-picture block in both Ogg comment variants at generation time.
const picture = read('pattern.png');
const mime = Buffer.from('image/png');
const words = (...values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeUInt32BE(v, i * 4)); return b; };
const block = Buffer.concat([words(3, mime.length), mime, words(0, 32, 32, 24, 0, picture.length), picture]).toString('base64');
for (const [name, codec] of [['tone.opus', 'libopus'], ['tone.ogg', 'libvorbis']]) {
  ff([...tone, '-c:a', codec, ...tags, '-metadata', `METADATA_BLOCK_PICTURE=${block}`], name);
}
for (const name of ['clip.mp4', 'clip.mkv', 'clip.webm', 'clip.mov']) {
  ff(['-f', 'lavfi', '-i', 'color=c=teal:size=32x32:rate=10:duration=0.3',
    '-c:v', name.endsWith('webm') ? 'libvpx' : 'libx264', '-pix_fmt', 'yuv420p', ...tags], name);
}
ff([...tone, '-c:a', 'aac', ...tags, '-f', 'ipod'], 'tone.m4a');

const doc = await PDFDocument.create();
doc.addPage([120, 120]).drawText('MeInsert fixture', { x: 8, y: 60, size: 10 });
doc.setTitle('Synthetic document'); doc.setAuthor('MeInsert fixture');
doc.setSubject('Preserve this subject'); doc.setKeywords(['synthetic', 'compatibility']);
doc.setCreator('MeInsert generator'); doc.setProducer('pdf-lib');
doc.setCreationDate(new Date('2026-01-02T00:00:00Z')); doc.setModificationDate(new Date('2026-01-02T00:00:00Z'));
out('document.pdf', await doc.save({ useObjectStreams: false }));

// Genuine detached CMS signature, self-signed test certificate (no CA/trust claim).
// Leave enough fixed-width space to patch ByteRange without shifting PDF offsets.
const sig = doc.context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached',
  ByteRange: [0, 1111111111, 2222222222, 3333333333], Contents: PDFHexString.of('0'.repeat(16384)) });
const sigRef = doc.context.register(sig);
const field = doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Widget', Rect: [0, 0, 0, 0],
  FT: 'Sig', T: PDFString.of('Synthetic signature'), V: sigRef, P: doc.getPage(0).ref, F: 4 }));
doc.getPage(0).node.addAnnot(field);
doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ Fields: [field], SigFlags: 3 }));
let signed = Buffer.from(await doc.save({ useObjectStreams: false }));
let text = signed.toString('latin1');
const contents = /\/Contents <([0-9A-Fa-f]{16384})>/.exec(text);
const start = contents.index + '/Contents '.length;
const end = start + contents[1].length + 2;
const placeholder = /\/ByteRange \[ 0 1111111111 2222222222 3333333333 \]/.exec(text)[0];
const range = `/ByteRange [ 0 ${start} ${end} ${signed.length - end} ]`.padEnd(placeholder.length);
text = text.replace(placeholder, range); signed = Buffer.from(text, 'latin1');
const temp = mkdtempSync(join(dir, '../tmp-sign-'));
try {
  const key = join(temp, 'key.pem'), cert = join(temp, 'cert.pem'), data = join(temp, 'data'), cms = join(temp, 'signature.der');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-subj', '/CN=MeInsert synthetic fixture/', '-days', '36500'], { stdio: 'ignore' });
  writeFileSync(data, Buffer.concat([signed.subarray(0, start), signed.subarray(end)]));
  execFileSync('openssl', ['cms', '-sign', '-binary', '-in', data, '-signer', cert, '-inkey', key, '-outform', 'DER', '-out', cms]);
  const signature = readFileSync(cms);
  signed.write(signature.toString('hex').padEnd(16384, '0'), start + 1, 'ascii');
  execFileSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', cms, '-content', data, '-noverify', '-out', join(temp, 'verified')], { stdio: 'ignore' });
  out('signed.pdf', signed);
  out('signed-certificate.pem', readFileSync(cert));
} finally { rmSync(temp, { recursive: true }); }
console.log('Generated synthetic image/audio/video/PDF fixtures; verified original signed.pdf CMS with OpenSSL.');
